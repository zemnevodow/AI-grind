import { humanDelay, randomInt, humanMouseMove } from '../utils/humanize.js';

/**
 * Плавный скролл
 */
async function smoothScroll(page, distance) {
  const steps = randomInt(15, 25);
  const baseStep = distance / steps;

  for (let i = 0; i < steps; i++) {
    const stepDistance = baseStep + randomInt(-3, 3);
    await page.mouse.wheel(0, stepDistance);
    await page.waitForTimeout(randomInt(10, 30));
  }
}

/**
 * Получить все твиты со страницы
 */
async function getTweets(page) {
  return await page.evaluate(() => {
    const tweets = [];
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    articles.forEach((article, index) => {
      // Получаем текст твита
      const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
      const tweetText = tweetTextEl ? tweetTextEl.innerText : '';

      // Проверяем, это reply или обычный твит
      // Reply имеет "Replying to" или находится в thread
      const replyingTo = article.querySelector('div[dir] > span')?.innerText?.includes('Replying to');
      const hasReplyContext = article.querySelector('[data-testid="Tweet-User-Avatar"]')?.closest('div')?.querySelector('a[href*="/status/"]');

      // Получаем имя автора
      const authorEl = article.querySelector('[data-testid="User-Name"]');
      const authorName = authorEl ? authorEl.innerText.split('\n')[0] : '';
      const authorHandle = authorEl ? authorEl.innerText.match(/@\w+/)?.[0] : '';

      // Получаем ссылку на твит
      const timeEl = article.querySelector('time');
      const tweetLink = timeEl ? timeEl.closest('a')?.href : null;

      // Определяем тип
      const isReply = !!replyingTo || article.innerHTML.includes('Replying to');
      const isRetweet = article.innerHTML.includes('reposted');
      const isQuote = !!article.querySelector('[data-testid="Tweet-User-Avatar"]')?.closest('article');

      tweets.push({
        index,
        text: tweetText,
        author: authorName,
        handle: authorHandle,
        link: tweetLink,
        isReply,
        isRetweet,
        isQuote,
        type: isReply ? 'reply' : isRetweet ? 'retweet' : isQuote ? 'quote' : 'tweet',
      });
    });

    return tweets;
  });
}

/**
 * Найти твит с ключевым словом
 */
function findTweetWithKeyword(tweets, keywords, options = {}) {
  const {
    caseSensitive = false,
    excludeReplies = true,
    excludeRetweets = true,
    excludeUrls = new Set(),
  } = options;

  // Поддержка и строки, и массива
  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const searchTerms = keywordList.map(k => caseSensitive ? k : k.toLowerCase());

  // Создаём regex для поиска целых слов/фраз
  // \b = граница слова (начало/конец слова)
  const patterns = searchTerms.map(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
  });

  return tweets.find(tweet => {
    // Фильтруем по типу
    if (excludeReplies && tweet.isReply) return false;
    if (excludeRetweets && tweet.isRetweet) return false;

    // Пропускаем уже лайкнутые
    if (tweet.link && excludeUrls.has(tweet.link)) return false;

    // Проверяем текст на любое из ключевых слов (целые слова)
    const text = tweet.text;
    return patterns.some(pattern => pattern.test(text));
  });
}

/**
 * Поиск твита с ключевым словом (скроллит пока не найдёт)
 */
export async function searchForTweet(page, keywords, options = {}) {
  const {
    maxScrolls = 50,
    excludeReplies = true,
    excludeRetweets = true,
    refreshInterval = 10, // Обновлять страницу каждые N скроллов
    onFound = null, // Callback когда найден твит
    excludeUrls = new Set(), // URLs уже лайкнутых твитов
  } = options;

  // Поддержка и строки, и массива
  const keywordList = Array.isArray(keywords) ? keywords : [keywords];

  console.log(`\nИщу твит с: ${keywordList.join(', ')}...`);
  console.log(`Настройки: исключить replies=${excludeReplies}, retweets=${excludeRetweets}`);
  if (excludeUrls.size > 0) {
    console.log(`Пропускаю ${excludeUrls.size} уже лайкнутых твитов`);
  }
  console.log('');

  let scrollCount = 0;
  let foundTweet = null;
  const seenLinks = new Set(); // Чтобы не проверять одни и те же твиты

  while (scrollCount < maxScrolls && !foundTweet) {
    // Получаем твиты на странице
    const tweets = await getTweets(page);

    // Фильтруем уже просмотренные
    const newTweets = tweets.filter(t => t.link && !seenLinks.has(t.link));
    newTweets.forEach(t => t.link && seenLinks.add(t.link));

    // Логируем найденные твиты
    if (newTweets.length > 0) {
      console.log(`  [Скролл ${scrollCount + 1}] Найдено ${newTweets.length} новых твитов`);

      // Показываем типы
      const types = newTweets.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`    Типы: ${JSON.stringify(types)}`);
    }

    // Ищем твит с ключевым словом
    foundTweet = findTweetWithKeyword(newTweets, keywordList, {
      excludeReplies,
      excludeRetweets,
      excludeUrls,
    });

    if (foundTweet) {
      console.log(`\n✅ Найден твит!`);
      console.log(`   Автор: ${foundTweet.author} (${foundTweet.handle})`);
      console.log(`   Текст: ${foundTweet.text.substring(0, 100)}...`);
      console.log(`   Тип: ${foundTweet.type}`);
      console.log(`   Ссылка: ${foundTweet.link}`);

      // Плавно скроллим к найденному твиту (центр экрана)
      console.log(`   Скроллю к твиту...`);
      const tweetElements = await page.$$('article[data-testid="tweet"]');
      if (tweetElements[foundTweet.index]) {
        await tweetElements[foundTweet.index].evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await humanDelay(800, 1200);
      }

      if (onFound) {
        await onFound(foundTweet, page);
      }

      return foundTweet;
    }

    // Скроллим дальше
    scrollCount++;
    await smoothScroll(page, randomInt(400, 700));
    await humanDelay(1500, 3000);

    // Периодически обновляем страницу
    if (scrollCount % refreshInterval === 0 && scrollCount < maxScrolls) {
      console.log(`  [Скролл ${scrollCount}] Обновляю страницу...`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await humanDelay(3000, 5000);
      // Сбрасываем seen чтобы заново проверить
      seenLinks.clear();
    }
  }

  console.log(`\n❌ Твит не найден после ${scrollCount} скроллов`);
  return null;
}

/**
 * Непрерывный мониторинг ленты в поисках твита
 */
export async function monitorForTweet(page, keywords, options = {}) {
  const {
    checkInterval = 30000, // Проверять каждые 30 секунд
    maxDuration = 30 * 60 * 1000, // Максимум 30 минут
    excludeReplies = true,
    excludeRetweets = true,
    onFound = null,
  } = options;

  const keywordList = Array.isArray(keywords) ? keywords : [keywords];

  console.log(`\nМониторинг ленты на: ${keywordList.join(', ')}...`);
  console.log(`Интервал: ${checkInterval / 1000}с, Максимум: ${maxDuration / 60000} мин`);

  const startTime = Date.now();
  let found = null;

  while (Date.now() - startTime < maxDuration && !found) {
    // Обновляем страницу
    console.log(`\n[${new Date().toLocaleTimeString()}] Обновляю ленту...`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await humanDelay(3000, 5000);

    // Ищем твит (небольшой скролл)
    found = await searchForTweet(page, keywordList, {
      maxScrolls: 5,
      excludeReplies,
      excludeRetweets,
      refreshInterval: 999, // Не обновлять внутри поиска
      onFound,
    });

    if (!found) {
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      console.log(`  Не найдено. Прошло ${elapsed} мин. Жду ${checkInterval / 1000}с...`);
      await humanDelay(checkInterval, checkInterval + 5000);
    }
  }

  return found;
}
