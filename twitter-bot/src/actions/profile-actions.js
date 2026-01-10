/**
 * Действия на странице профиля пользователя
 * Для поиска Target Tweet (последний твит bluemark'а)
 */

import { humanDelay, randomInt } from '../utils/humanize.js';

/**
 * @typedef {Object} ProfileTweet
 * @property {string} text - текст твита
 * @property {string} time - время публикации
 * @property {string|null} link - ссылка на твит
 * @property {boolean} isPinned - закреплённый твит
 * @property {boolean} isRetweet - это ретвит
 * @property {boolean} isReply - это реплай
 */

/**
 * Получить последний оригинальный твит из профиля пользователя
 * Пропускает: pinned, retweets, replies
 *
 * @param {Page} page - страница должна быть открыта на профиле
 * @returns {Promise<ProfileTweet|null>}
 */
export async function getLatestTweet(page) {
  // Ждем загрузки твитов
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
  } catch {
    console.log('Твиты не загрузились в профиле');
    return null;
  }

  await humanDelay(1000, 1500);

  return await page.evaluate(() => {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    for (const article of articles) {
      const articleText = article.innerText;

      // Пропускаем pinned tweet (он может быть старым)
      const isPinned = articleText.includes('Pinned');
      if (isPinned) continue;

      // Пропускаем retweets
      const isRetweet = articleText.includes('reposted') ||
                        articleText.includes('Retweeted');
      if (isRetweet) continue;

      // Пропускаем replies (ответы на чужие твиты)
      const isReply = articleText.includes('Replying to');
      if (isReply) continue;

      // Это оригинальный твит - берём его
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector('time');
      const linkEl = timeEl?.closest('a');

      return {
        text: textEl ? textEl.innerText : '',
        time: timeEl ? timeEl.innerText : '',
        link: linkEl ? linkEl.href : null,
        isPinned: false,
        isRetweet: false,
        isReply: false,
      };
    }

    return null;
  });
}

/**
 * Получить первый твит из профиля (любой, включая pinned/retweet)
 * Используется как fallback если нет оригинальных твитов
 *
 * @param {Page} page
 * @returns {Promise<ProfileTweet|null>}
 */
export async function getFirstTweet(page) {
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
  } catch {
    return null;
  }

  await humanDelay(500, 1000);

  return await page.evaluate(() => {
    const article = document.querySelector('article[data-testid="tweet"]');
    if (!article) return null;

    const articleText = article.innerText;

    const textEl = article.querySelector('[data-testid="tweetText"]');
    const timeEl = article.querySelector('time');
    const linkEl = timeEl?.closest('a');

    return {
      text: textEl ? textEl.innerText : '',
      time: timeEl ? timeEl.innerText : '',
      link: linkEl ? linkEl.href : null,
      isPinned: articleText.includes('Pinned'),
      isRetweet: articleText.includes('reposted') || articleText.includes('Retweeted'),
      isReply: articleText.includes('Replying to'),
    };
  });
}

/**
 * Проверить, есть ли вообще твиты в профиле
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function hasAnyTweets(page) {
  const tweet = await page.$('article[data-testid="tweet"]');
  return !!tweet;
}

/**
 * Проверить, является ли профиль приватным
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function isPrivateProfile(page) {
  // Ищем иконку замка
  const protectedLabel = await page.$('[data-testid="icon-lock"]');
  if (protectedLabel) return true;

  // Проверяем текст на странице
  const protectedText = await page.evaluate(() =>
    document.body.innerText.includes("These Tweets are protected") ||
    document.body.innerText.includes("These posts are protected")
  );

  return protectedText;
}

/**
 * Проверить, заблокирован ли пользователь
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function isBlockedProfile(page) {
  const blockedText = await page.evaluate(() =>
    document.body.innerText.includes("You're blocked") ||
    document.body.innerText.includes("You are blocked")
  );

  return blockedText;
}

/**
 * Проверить, существует ли профиль
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function profileExists(page) {
  const notFound = await page.evaluate(() =>
    document.body.innerText.includes("This account doesn't exist") ||
    document.body.innerText.includes("Account suspended")
  );

  return !notFound;
}

/**
 * Получить информацию о профиле
 *
 * @param {Page} page
 * @returns {Promise<{name: string, handle: string, bio: string, isVerified: boolean}>}
 */
export async function getProfileInfo(page) {
  await humanDelay(500, 1000);

  return await page.evaluate(() => {
    // Имя
    const nameEl = document.querySelector('[data-testid="UserName"]');
    const name = nameEl ? nameEl.innerText.split('\n')[0] : '';

    // Handle
    const handleMatch = nameEl?.innerText.match(/@[\w]+/);
    const handle = handleMatch ? handleMatch[0] : '';

    // Bio
    const bioEl = document.querySelector('[data-testid="UserDescription"]');
    const bio = bioEl ? bioEl.innerText : '';

    // Verified
    const verifiedBadge = document.querySelector('[data-testid="icon-verified"]');
    const isVerified = !!verifiedBadge;

    return { name, handle, bio, isVerified };
  });
}

/**
 * Подождать загрузки профиля
 *
 * @param {Page} page
 * @param {number} timeout - таймаут в мс
 * @returns {Promise<boolean>} - true если профиль загрузился
 */
export async function waitForProfileLoad(page, timeout = 10000) {
  try {
    // Ждём появления имени пользователя или сообщения об ошибке
    await Promise.race([
      page.waitForSelector('[data-testid="UserName"]', { timeout }),
      page.waitForSelector('text="This account doesn\'t exist"', { timeout }),
      page.waitForSelector('text="Account suspended"', { timeout }),
    ]);
    return true;
  } catch {
    return false;
  }
}
