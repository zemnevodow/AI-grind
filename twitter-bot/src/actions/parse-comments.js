/**
 * Парсинг комментариев под твитом
 * Для поиска Bluemark (верифицированных пользователей)
 */

import { humanDelay, randomInt } from '../utils/humanize.js';

/**
 * @typedef {Object} ParsedComment
 * @property {number} index - позиция в DOM (0 = seed tweet, 1+ = комментарии)
 * @property {string} author - имя автора
 * @property {string} handle - @username
 * @property {string} text - текст комментария
 * @property {string} time - время публикации (raw text: "2h", "5m", etc.)
 * @property {Date|null} timestamp - попытка парсинга в Date
 * @property {boolean} isVerified - есть ли синяя галочка
 * @property {string|null} profileUrl - ссылка на профиль
 * @property {string|null} commentUrl - ссылка на сам комментарий
 */

/**
 * Парсинг комментариев под твитом
 * Страница должна быть открыта на странице твита (x.com/user/status/123)
 *
 * @param {Page} page - Playwright page
 * @returns {Promise<ParsedComment[]>}
 */
export async function parseComments(page) {
  return await page.evaluate(() => {
    const comments = [];

    // На странице твита: первый article - сам твит, остальные - комментарии
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    // Пропускаем первый (это seed tweet, index 0)
    for (let i = 1; i < articles.length; i++) {
      const article = articles[i];

      // Имя и handle
      const userNameEl = article.querySelector('[data-testid="User-Name"]');
      let author = '';
      let handle = '';

      if (userNameEl) {
        const textContent = userNameEl.innerText;
        const lines = textContent.split('\n');
        author = lines[0] || '';
        handle = textContent.match(/@[\w]+/)?.[0] || '';
      }

      // Текст комментария
      const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
      const text = tweetTextEl ? tweetTextEl.innerText : '';

      // Время публикации
      const timeEl = article.querySelector('time');
      const time = timeEl ? timeEl.innerText : '';
      const datetime = timeEl ? timeEl.getAttribute('datetime') : null;

      // Verified badge - проверяем несколькими способами
      let isVerified = false;

      // Метод 1: data-testid
      const verifiedBadge = article.querySelector('[data-testid="icon-verified"]');
      if (verifiedBadge) {
        isVerified = true;
      }

      // Метод 2: aria-label на SVG
      if (!isVerified) {
        const svgBadge = article.querySelector('svg[aria-label*="Verified"]');
        if (svgBadge) {
          isVerified = true;
        }
      }

      // Метод 3: Blue checkmark
      if (!isVerified) {
        const blueBadge = article.querySelector('svg[aria-label="Blue checkmark"]');
        if (blueBadge) {
          isVerified = true;
        }
      }

      // URL профиля (из ссылки на имя пользователя)
      let profileUrl = null;
      if (userNameEl) {
        const profileLink = userNameEl.querySelector('a[href^="/"]');
        if (profileLink) {
          const href = profileLink.getAttribute('href');
          // Извлекаем только username (первая часть пути)
          const match = href.match(/^\/([^/]+)/);
          if (match) {
            profileUrl = `https://x.com/${match[1]}`;
          }
        }
      }

      // URL комментария (из ссылки на время)
      const commentLink = timeEl?.closest('a');
      const commentUrl = commentLink ? commentLink.href : null;

      comments.push({
        index: i,
        author,
        handle,
        text,
        time,
        timestamp: datetime ? new Date(datetime) : null,
        isVerified,
        profileUrl,
        commentUrl,
      });
    }

    return comments;
  });
}

/**
 * Найти самый свежий комментарий от Bluemark
 * Twitter показывает комментарии в хронологическом порядке (новые сверху)
 *
 * @param {ParsedComment[]} comments
 * @returns {ParsedComment|null}
 */
export function findLatestBluemarkComment(comments) {
  // Фильтруем только verified
  const bluemarks = comments.filter(c => c.isVerified);

  if (bluemarks.length === 0) return null;

  // Сортируем по времени (самый свежий первый)
  // Если есть timestamp - используем его
  // Иначе по позиции (меньший index = выше в ленте = более новый на Twitter)
  bluemarks.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return b.timestamp.getTime() - a.timestamp.getTime();
    }
    // Fallback: меньший index = более новый комментарий
    return a.index - b.index;
  });

  return bluemarks[0];
}

/**
 * Получить всех bluemark'ов из комментариев
 *
 * @param {ParsedComment[]} comments
 * @returns {ParsedComment[]}
 */
export function getAllBluemarkComments(comments) {
  return comments.filter(c => c.isVerified);
}

/**
 * Подгрузить больше комментариев (скролл вниз)
 *
 * @param {Page} page
 * @param {number} scrollCount - сколько раз скроллить
 */
export async function loadMoreComments(page, scrollCount = 3) {
  for (let i = 0; i < scrollCount; i++) {
    // Плавный скролл
    const scrollDistance = randomInt(400, 600);
    const steps = randomInt(10, 20);
    const stepDistance = scrollDistance / steps;

    for (let j = 0; j < steps; j++) {
      await page.mouse.wheel(0, stepDistance);
      await page.waitForTimeout(randomInt(20, 50));
    }

    // Ждем подгрузки контента
    await humanDelay(1500, 2500);
  }
}

/**
 * Проверить, есть ли кнопка "Show more replies"
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function hasMoreReplies(page) {
  const showMoreButton = await page.$('div[role="button"]:has-text("Show")');
  return !!showMoreButton;
}

/**
 * Кликнуть "Show more replies" если есть
 *
 * @param {Page} page
 * @returns {Promise<boolean>} - true если клик был сделан
 */
export async function clickShowMoreReplies(page) {
  const showMoreButton = await page.$('div[role="button"]:has-text("Show")');

  if (showMoreButton) {
    await showMoreButton.click();
    await humanDelay(2000, 3000);
    return true;
  }

  return false;
}
