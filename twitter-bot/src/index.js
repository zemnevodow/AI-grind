/**
 * Bluemark Engagement Bot
 *
 * Алгоритм:
 * 1. Скроллим ленту, имитируем "чтение" твитов
 * 2. Находим Seed Tweet (содержит gm/gn)
 * 3. Открываем Seed Tweet → парсим комментарии
 * 4. Находим самый свежий комментарий от Bluemark (верифицированный)
 * 5. Переходим в Target Profile (профиль bluemark'а)
 * 6. Находим Target Tweet (последний оригинальный твит)
 *    - Fallback: если нет твитов → лайкаем комментарий bluemark'а
 * 7. Лайкаем + комментируем Target Tweet
 * 8. Повторяем до достижения COMMENT_GOAL
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';

// Actions
import { searchForTweet } from './actions/search-tweets.js';
import { parseComments, findLatestBluemarkComment, loadMoreComments } from './actions/parse-comments.js';
import { getLatestTweet, isPrivateProfile, profileExists, waitForProfileLoad } from './actions/profile-actions.js';
import { likeTweetByUrl } from './actions/like.js';
import { commentByUrl, loadCommentTemplates, getRandomComment } from './actions/comment.js';

// Utils
import { humanDelay, randomInt, simulateTweetReading, simulateFeedBrowsing } from './utils/humanize.js';
import { applyStealth } from './utils/stealth.js';

const config = {
  headless: process.env.HEADLESS !== 'false',
  sessionFile: 'twitter-session.json',
  // Twitter List URL или Home
  targetUrl: process.env.TWITTER_LIST_URL || 'https://x.com/home',
  // Ключевые слова для поиска Seed Tweet
  searchKeywords: (process.env.SEARCH_KEYWORDS || 'gm,gn').split(',').map(k => k.trim()),
  // Цель: сколько Target Tweets обработать (лайк + коммент)
  commentGoal: parseInt(process.env.COMMENT_GOAL, 10) || 100,
  // Время чтения твитов
  minReadTime: parseInt(process.env.MIN_READ_TIME, 10) || 2000,
  maxReadTime: parseInt(process.env.MAX_READ_TIME, 10) || 6000,
};

// Трекинг обработанных bluemark'ов (чтобы не комментить одного дважды)
const processedBluemarks = new Set();
// Трекинг обработанных seed tweets
const processedSeedTweets = new Set();

async function main() {
  // Проверяем наличие сессии
  if (!existsSync(config.sessionFile)) {
    console.error('Ошибка: Сессия не найдена!');
    console.log('');
    console.log('Сначала залогинься:');
    console.log('  npm run login');
    console.log('');
    process.exit(1);
  }

  // Загружаем сессию
  const sessionData = JSON.parse(readFileSync(config.sessionFile, 'utf-8'));
  console.log(`Сессия от: ${sessionData.savedAt}`);

  console.log('');
  console.log('='.repeat(60));
  console.log('  Bluemark Engagement Bot');
  console.log('='.repeat(60));
  console.log(`Режим: ${config.headless ? 'headless' : 'visible'}`);
  console.log(`Цель: ${config.commentGoal} комментариев`);
  console.log(`Ключевые слова: ${config.searchKeywords.join(', ')}`);
  console.log('');

  let browser;

  try {
    console.log('Запускаю браузер...');
    browser = await chromium.launch({
      headless: config.headless,
      channel: 'chrome',
      slowMo: 50,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Применяем stealth патчи
    console.log('Применяю stealth режим...');
    await applyStealth(context);

    // Загружаем cookies
    console.log('Загружаю cookies...');
    await context.addCookies(sessionData.cookies);

    const page = await context.newPage();

    // Открываем Twitter
    console.log(`Открываю: ${config.targetUrl}`);
    await page.goto(config.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('Страница загружена');

    await page.waitForTimeout(3000);

    // Проверяем авторизацию
    console.log('Проверяю авторизацию...');

    if (page.url().includes('/login') || page.url().includes('/i/flow/login')) {
      console.error('Редирект на страницу логина — сессия истекла');
      console.log('Перелогинься: npm run login');
      process.exit(1);
    }

    const selectors = [
      '[data-testid="AppTabBar_Home_Link"]',
      '[data-testid="primaryColumn"]',
      'article',
    ];

    let isLoggedIn = false;
    for (const selector of selectors) {
      const el = await page.$(selector);
      if (el) {
        isLoggedIn = true;
        break;
      }
    }

    if (!isLoggedIn) {
      console.error('Не удалось подтвердить авторизацию');
      throw new Error('Авторизация не подтверждена');
    }

    console.log('Авторизация OK!');
    await page.waitForTimeout(2000);

    // Загружаем шаблоны комментариев
    const commentTemplates = loadCommentTemplates();
    console.log(`Загружено ${commentTemplates.length} шаблонов комментариев`);
    console.log('');

    // Счётчики
    let commentsCount = 0;
    let likesCount = 0;
    let skippedBluemarks = 0;

    // ==================== ОСНОВНОЙ ЦИКЛ ====================
    while (commentsCount < config.commentGoal) {
      console.log('');
      console.log(`[${'█'.repeat(Math.floor(commentsCount / config.commentGoal * 20))}${'░'.repeat(20 - Math.floor(commentsCount / config.commentGoal * 20))}] ${commentsCount}/${config.commentGoal}`);
      console.log('');

      // === Шаг 1: Имитация чтения ленты ===
      console.log('📖 Имитирую чтение ленты...');
      await simulateFeedBrowsing(page, randomInt(2, 4));

      // === Шаг 2: Поиск Seed Tweet ===
      console.log(`🔍 Ищу Seed Tweet (${config.searchKeywords.join(', ')})...`);

      const seedTweet = await searchForTweet(page, config.searchKeywords, {
        maxScrolls: 30,
        excludeReplies: true,
        excludeRetweets: true,
        excludeUrls: processedSeedTweets,
      });

      if (!seedTweet || !seedTweet.link) {
        console.log('❌ Seed Tweet не найден');
        console.log('⏳ Жду 30 сек и обновляю страницу...');
        await humanDelay(30000, 45000);
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await humanDelay(3000, 5000);
        continue;
      }

      processedSeedTweets.add(seedTweet.link);
      console.log(`✅ Seed Tweet найден: ${seedTweet.author}`);
      console.log(`   ${seedTweet.text.substring(0, 50)}...`);

      // === Шаг 3: Открываем Seed Tweet ===
      console.log('');
      console.log('📄 Открываю страницу твита...');
      await page.goto(seedTweet.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await humanDelay(2000, 3000);

      // Имитируем чтение seed tweet
      const seedTweetEl = await page.$('article[data-testid="tweet"]');
      if (seedTweetEl) {
        await simulateTweetReading(page, seedTweetEl, {
          minReadTime: config.minReadTime,
          maxReadTime: config.maxReadTime,
        });
      }

      // Подгружаем комментарии
      console.log('📜 Загружаю комментарии...');
      await loadMoreComments(page, randomInt(2, 4));

      // === Шаг 4: Парсим комментарии, ищем Bluemark ===
      const comments = await parseComments(page);
      console.log(`   Найдено ${comments.length} комментариев`);

      const bluemarkComment = findLatestBluemarkComment(comments);

      if (!bluemarkComment) {
        console.log('❌ Bluemark не найден в комментариях');
        console.log('   Ищу следующий Seed Tweet...');
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await humanDelay(3000, 5000);
        continue;
      }

      // Проверяем, не обрабатывали ли уже этого bluemark
      if (processedBluemarks.has(bluemarkComment.handle)) {
        console.log(`⏭️ Bluemark ${bluemarkComment.handle} уже обработан, пропускаю...`);
        skippedBluemarks++;
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await humanDelay(2000, 3000);
        continue;
      }

      console.log(`✅ Bluemark найден: ${bluemarkComment.author} (${bluemarkComment.handle})`);
      console.log(`   Комментарий: ${bluemarkComment.text.substring(0, 50)}...`);

      // === Шаг 5: Переходим в Target Profile ===
      const profileUrl = bluemarkComment.profileUrl || `https://x.com/${bluemarkComment.handle.replace('@', '')}`;
      console.log('');
      console.log(`👤 Открываю профиль: ${profileUrl}`);

      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await humanDelay(2000, 3000);

      // Проверяем профиль
      const profileLoaded = await waitForProfileLoad(page, 10000);
      if (!profileLoaded) {
        console.log('❌ Профиль не загрузился');
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        continue;
      }

      if (!await profileExists(page)) {
        console.log('❌ Профиль не существует или заблокирован');
        processedBluemarks.add(bluemarkComment.handle);
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        continue;
      }

      if (await isPrivateProfile(page)) {
        console.log('🔒 Профиль приватный, пропускаю');
        processedBluemarks.add(bluemarkComment.handle);
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        continue;
      }

      // === Шаг 6: Находим Target Tweet ===
      console.log('🎯 Ищу Target Tweet (последний оригинальный твит)...');

      const targetTweet = await getLatestTweet(page);

      if (!targetTweet || !targetTweet.link) {
        // Fallback: лайкаем комментарий bluemark'а под seed tweet
        console.log('❌ Твитов не найдено в профиле');
        console.log('📌 Fallback: лайкаю комментарий bluemark\'а под Seed Tweet');

        if (bluemarkComment.commentUrl) {
          await page.goto(bluemarkComment.commentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await humanDelay(2000, 3000);

          const liked = await likeTweetByUrl(page, bluemarkComment.commentUrl);
          if (liked) {
            likesCount++;
            commentsCount++; // Считаем как действие
            processedBluemarks.add(bluemarkComment.handle);
            console.log(`✅ Лайк на комментарий поставлен! (${commentsCount}/${config.commentGoal})`);
          }
        }

        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await humanDelay(3000, 5000);
        continue;
      }

      console.log(`✅ Target Tweet найден: ${targetTweet.text.substring(0, 50)}...`);

      // === Шаг 7: Лайкаем + комментируем Target Tweet ===
      console.log('');
      console.log('📄 Открываю Target Tweet...');
      await page.goto(targetTweet.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await humanDelay(2000, 3000);

      // Имитируем чтение перед действием
      const targetTweetEl = await page.$('article[data-testid="tweet"]');
      if (targetTweetEl) {
        await simulateTweetReading(page, targetTweetEl, {
          minReadTime: config.minReadTime,
          maxReadTime: config.maxReadTime,
        });
      }

      // Рандомный порядок: 50% лайк→коммент, 50% коммент→лайк
      const likeFirst = randomInt(0, 1) === 0;
      console.log(`🎲 Порядок: ${likeFirst ? 'лайк → коммент' : 'коммент → лайк'}`);

      let liked = false;
      let commented = false;

      // Готовим комментарий
      const comment = getRandomComment(commentTemplates, {
        author: bluemarkComment.author,
        handle: bluemarkComment.handle,
      });

      // Функция лайка
      const doLike = async () => {
        console.log('❤️ Ставлю лайк...');
        liked = await likeTweetByUrl(page, targetTweet.link);
        if (liked) {
          likesCount++;
          console.log('✅ Лайк поставлен!');
        }
      };

      // Функция комментария
      const doComment = async () => {
        console.log(`💬 Пишу комментарий: "${comment}"`);
        commented = await commentByUrl(page, targetTweet.link, comment);
        if (commented) {
          console.log('✅ Комментарий отправлен!');
        } else {
          console.log('⚠️ Не удалось оставить комментарий');
        }
      };

      // Выполняем в выбранном порядке
      if (likeFirst) {
        await doLike();
        await humanDelay(1000, 2000);
        await doComment();
      } else {
        await doComment();
        await humanDelay(1000, 2000);
        await doLike();
      }

      // Отмечаем bluemark как обработанного
      processedBluemarks.add(bluemarkComment.handle);

      // Увеличиваем счётчик если хотя бы одно действие успешно
      if (liked || commented) {
        commentsCount++;
        console.log('');
        console.log(`📊 Прогресс: ${commentsCount}/${config.commentGoal} | Лайков: ${likesCount}`);
      }

      // Возвращаемся в ленту
      console.log('');
      console.log('🔙 Возвращаюсь в ленту...');
      await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await humanDelay(3000, 5000);
    }

    // ==================== ЗАВЕРШЕНИЕ ====================
    console.log('');
    console.log('='.repeat(60));
    console.log('  ГОТОВО!');
    console.log('='.repeat(60));
    console.log(`  ✅ Обработано: ${commentsCount} bluemark'ов`);
    console.log(`  ❤️ Лайков: ${likesCount}`);
    console.log(`  ⏭️ Пропущено (уже обработаны): ${skippedBluemarks}`);
    console.log(`  📄 Seed Tweets просмотрено: ${processedSeedTweets.size}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('');
    console.error('Ошибка:', error.message);

    if (!config.headless && browser) {
      console.log('');
      console.log('>>> Браузер открыт для отладки. Ctrl+C чтобы закрыть.');
      await new Promise(() => {});
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
