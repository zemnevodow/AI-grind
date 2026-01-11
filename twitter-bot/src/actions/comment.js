import { humanDelay, humanType, humanMouseMove, randomInt } from '../utils/humanize.js';
import { readFileSync, existsSync } from 'fs';

// Стратегии комментирования
export const COMMENT_STRATEGIES = ['fromFeed', 'fromTweetPage', 'fromInlineForm'];

/**
 * Выбрать случайную стратегию комментирования
 */
export function getRandomStrategy() {
  return COMMENT_STRATEGIES[randomInt(0, COMMENT_STRATEGIES.length - 1)];
}

/**
 * Загрузить шаблоны комментариев
 */
export function loadCommentTemplates(filePath = 'comments.json') {
  if (!existsSync(filePath)) {
    console.log('Файл шаблонов не найден, используем дефолтные');
    return [
      'hey, let\'s connect',
      'sup fam, lets follow back',
      'let\'s grow together',
      'yo lets connect!'
    ];
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return data.templates || data;
  } catch (e) {
    console.error('Ошибка загрузки шаблонов:', e.message);
    return ['hey, let\'s connect'];
  }
}

/**
 * Выбрать случайный шаблон и заполнить плейсхолдеры
 */
export function getRandomComment(templates, context = {}) {
  const template = templates[randomInt(0, templates.length - 1)];

  return template
    .replace('{author}', context.author || '')
    .replace('{handle}', context.handle || '')
    .replace('{keyword}', context.keyword || '')
    .trim();
}

/**
 * Комментировать твит на текущей странице (по индексу)
 */
export async function commentByIndex(page, index, text, options = {}) {
  const { waitAfter = true } = options;

  const tweets = await page.$$('article[data-testid="tweet"]');

  if (index >= tweets.length) {
    console.log(`Твит с индексом ${index} не найден`);
    return false;
  }

  const tweet = tweets[index];
  return await commentOnTweet(page, tweet, text, { waitAfter });
}

/**
 * Плавный скролл к элементу
 */
async function smoothScrollToElement(page, element, block = 'center') {
  await element.evaluate((el, b) => {
    el.scrollIntoView({ behavior: 'smooth', block: b });
  }, block);
  await humanDelay(600, 1000);
}

/**
 * Плавный скролл страницы на определённое расстояние
 */
async function smoothScrollBy(page, distance, steps = 20) {
  const stepDistance = distance / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepDistance + randomInt(-2, 2));
    await page.waitForTimeout(randomInt(15, 35));
  }
}

/**
 * Комментировать твит по URL
 */
export async function commentByUrl(page, tweetUrl, text, options = {}) {
  const { waitAfter = true } = options;

  console.log(`Открываю твит: ${tweetUrl}`);
  await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  const tweet = await page.$('article[data-testid="tweet"]');

  if (!tweet) {
    console.log('Твит не найден на странице');
    return false;
  }

  // Плавно скроллим к твиту (чтобы был виден)
  console.log('Скроллю к твиту...');
  await smoothScrollToElement(page, tweet, 'start');
  await humanDelay(500, 800);

  // Плавно скроллим чуть ниже к области комментирования
  console.log('Скроллю к форме ответа...');
  await smoothScrollBy(page, 150);
  await humanDelay(400, 600);

  return await commentOnTweet(page, tweet, text, { waitAfter });
}

/**
 * Оставить комментарий к твиту
 */
export async function commentOnTweet(page, tweetElement, text, options = {}) {
  const { waitAfter = true } = options;

  try {
    // 1. Находим кнопку reply
    const replyButton = await tweetElement.$('[data-testid="reply"]');

    if (!replyButton) {
      console.log('Кнопка reply не найдена');
      return false;
    }

    // 2. Наводим мышь и кликаем
    const box = await replyButton.boundingBox();
    if (box) {
      const x = box.x + box.width / 2 + randomInt(-3, 3);
      const y = box.y + box.height / 2 + randomInt(-2, 2);

      console.log('Навожу на кнопку reply...');
      await humanMouseMove(page, x, y);
      await humanDelay(200, 400);
    }

    console.log('Открываю форму ответа...');
    await replyButton.click();
    await humanDelay(1000, 1500);

    // 3. Ждём появления текстового поля
    const textareaSelector = '[data-testid="tweetTextarea_0"]';
    await page.waitForSelector(textareaSelector, { timeout: 5000 });
    await humanDelay(300, 500);

    // 4. Кликаем на текстовое поле
    const textarea = await page.$(textareaSelector);
    if (!textarea) {
      console.log('Текстовое поле не найдено');
      return false;
    }

    // Наводим мышь на поле ввода
    const textareaBox = await textarea.boundingBox();
    if (textareaBox) {
      console.log('Навожу на поле ввода...');
      await humanMouseMove(page, textareaBox.x + textareaBox.width / 2, textareaBox.y + textareaBox.height / 2);
      await humanDelay(200, 400);
    }

    console.log('Кликаю на поле ввода...');
    await textarea.click();
    await humanDelay(200, 400);

    // 5. Вводим текст с имитацией набора
    console.log(`Пишу комментарий: "${text}"`);
    await humanType(page, textareaSelector, text);
    await humanDelay(500, 800);

    // 6. Находим и кликаем кнопку отправки
    const submitButton = await page.$('[data-testid="tweetButton"]');

    if (!submitButton) {
      console.log('Кнопка отправки не найдена');
      return false;
    }

    // Проверяем, что кнопка активна
    const isDisabled = await submitButton.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true');
    if (isDisabled) {
      console.log('Кнопка отправки неактивна');
      return false;
    }

    // Наводим и кликаем
    const submitBox = await submitButton.boundingBox();
    if (submitBox) {
      const x = submitBox.x + submitBox.width / 2 + randomInt(-3, 3);
      const y = submitBox.y + submitBox.height / 2 + randomInt(-2, 2);

      console.log('Навожу на кнопку отправки...');
      await humanMouseMove(page, x, y);
      await humanDelay(200, 400);
    }

    console.log('Отправляю комментарий...');
    await submitButton.click();

    if (waitAfter) {
      // Ждём подтверждения отправки (модалка закроется или появится твит)
      await humanDelay(2000, 3000);
    }

    console.log('Комментарий отправлен!');
    return true;

  } catch (error) {
    console.error('Ошибка при комментировании:', error.message);
    return false;
  }
}

/**
 * Ответить на твит со случайным шаблоном
 */
export async function replyWithTemplate(page, tweetUrl, templates, context = {}) {
  const comment = getRandomComment(templates, context);
  console.log(`Выбран шаблон: "${comment}"`);
  return await commentByUrl(page, tweetUrl, comment);
}

/**
 * Стратегия 1: Комментировать прямо из ленты (модалка)
 */
export async function commentFromFeed(page, tweetIndex, text) {
  console.log(`📝 Стратегия: комментирую из ленты (модалка)`);

  const tweets = await page.$$('article[data-testid="tweet"]');
  if (tweetIndex >= tweets.length) {
    console.log('Твит не найден в ленте');
    return false;
  }

  const tweet = tweets[tweetIndex];

  // Скроллим к твиту
  await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await humanDelay(600, 1000);

  // Кликаем reply — откроется модалка
  const replyButton = await tweet.$('[data-testid="reply"]');
  if (!replyButton) {
    console.log('Кнопка reply не найдена');
    return false;
  }

  const box = await replyButton.boundingBox();
  if (box) {
    await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await humanDelay(200, 400);
  }

  await replyButton.click();
  await humanDelay(1000, 1500);

  // Ждём модалку с текстовым полем
  const textareaSelector = '[data-testid="tweetTextarea_0"]';
  try {
    await page.waitForSelector(textareaSelector, { timeout: 5000 });
  } catch {
    console.log('Модалка не открылась');
    return false;
  }

  // Скроллим модалку к полю ввода (на случай если не видно)
  const textarea = await page.$(textareaSelector);
  if (textarea) {
    await textarea.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await humanDelay(300, 500);
  }

  // Наводим мышь на поле ввода
  const textareaBox = await textarea.boundingBox();
  if (textareaBox) {
    console.log('Навожу на поле ввода...');
    await humanMouseMove(page, textareaBox.x + textareaBox.width / 2, textareaBox.y + textareaBox.height / 2);
    await humanDelay(200, 400);
  }

  // Кликаем и печатаем
  await textarea.click();
  await humanDelay(200, 400);

  console.log(`Пишу комментарий: "${text}"`);
  await humanType(page, textareaSelector, text);
  await humanDelay(500, 800);

  // Отправляем
  const submitButton = await page.$('[data-testid="tweetButton"]');
  if (!submitButton) {
    console.log('Кнопка отправки не найдена');
    return false;
  }

  const submitBox = await submitButton.boundingBox();
  if (submitBox) {
    await humanMouseMove(page, submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2);
    await humanDelay(200, 400);
  }

  await submitButton.click();
  await humanDelay(2000, 3000);

  console.log('Комментарий отправлен!');
  return true;
}

/**
 * Стратегия 2: Перейти в твит, кликнуть reply (модалка)
 */
export async function commentFromTweetPage(page, tweetUrl, text) {
  console.log(`📝 Стратегия: перехожу в твит → reply (модалка)`);

  await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  const tweet = await page.$('article[data-testid="tweet"]');
  if (!tweet) {
    console.log('Твит не найден');
    return false;
  }

  // Скроллим к твиту
  await smoothScrollToElement(page, tweet, 'center');
  await humanDelay(500, 800);

  // Кликаем reply
  const replyButton = await tweet.$('[data-testid="reply"]');
  if (!replyButton) {
    console.log('Кнопка reply не найдена');
    return false;
  }

  const box = await replyButton.boundingBox();
  if (box) {
    await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await humanDelay(200, 400);
  }

  await replyButton.click();
  await humanDelay(1000, 1500);

  // Ждём модалку
  const textareaSelector = '[data-testid="tweetTextarea_0"]';
  try {
    await page.waitForSelector(textareaSelector, { timeout: 5000 });
  } catch {
    console.log('Модалка не открылась');
    return false;
  }

  const textarea = await page.$(textareaSelector);

  // Наводим мышь на поле ввода
  const textareaBox = await textarea.boundingBox();
  if (textareaBox) {
    console.log('Навожу на поле ввода...');
    await humanMouseMove(page, textareaBox.x + textareaBox.width / 2, textareaBox.y + textareaBox.height / 2);
    await humanDelay(200, 400);
  }

  await textarea.click();
  await humanDelay(200, 400);

  console.log(`Пишу комментарий: "${text}"`);
  await humanType(page, textareaSelector, text);
  await humanDelay(500, 800);

  const submitButton = await page.$('[data-testid="tweetButton"]');
  if (!submitButton) return false;

  const submitBox = await submitButton.boundingBox();
  if (submitBox) {
    await humanMouseMove(page, submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2);
    await humanDelay(200, 400);
  }

  await submitButton.click();
  await humanDelay(2000, 3000);

  console.log('Комментарий отправлен!');
  return true;
}

/**
 * Стратегия 3: Перейти в твит, писать в inline форме под твитом
 */
export async function commentFromInlineForm(page, tweetUrl, text) {
  console.log(`📝 Стратегия: перехожу в твит → inline форма`);

  await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  const tweet = await page.$('article[data-testid="tweet"]');
  if (!tweet) {
    console.log('Твит не найден');
    return false;
  }

  // Скроллим к твиту
  await smoothScrollToElement(page, tweet, 'start');
  await humanDelay(500, 800);

  // Скроллим ниже к inline форме
  await smoothScrollBy(page, 200);
  await humanDelay(400, 600);

  // Ищем inline форму (она под основным твитом)
  // Обычно это div с placeholder "Post your reply"
  const inlineFormSelector = '[data-testid="tweetTextarea_0"]';

  let textarea = await page.$(inlineFormSelector);

  // Если не нашли сразу, ищем кликабельную область для начала ввода
  if (!textarea) {
    const replyPlaceholder = await page.$('[data-text="true"]');
    if (replyPlaceholder) {
      // Наводим мышь на placeholder
      const placeholderBox = await replyPlaceholder.boundingBox();
      if (placeholderBox) {
        console.log('Навожу на поле ввода...');
        await humanMouseMove(page, placeholderBox.x + placeholderBox.width / 2, placeholderBox.y + placeholderBox.height / 2);
        await humanDelay(200, 400);
      }
      await replyPlaceholder.click();
      await humanDelay(500, 800);
      textarea = await page.$(inlineFormSelector);
    }
  }

  if (!textarea) {
    // Фоллбэк на обычную кнопку reply
    console.log('Inline форма не найдена, использую reply кнопку');
    return await commentFromTweetPage(page, tweetUrl, text);
  }

  // Скроллим к форме
  await textarea.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await humanDelay(400, 600);

  const box = await textarea.boundingBox();
  if (box) {
    await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await humanDelay(200, 400);
  }

  await textarea.click();
  await humanDelay(300, 500);

  console.log(`Пишу комментарий: "${text}"`);
  await humanType(page, inlineFormSelector, text);
  await humanDelay(500, 800);

  // Кнопка Reply в inline форме
  const submitButton = await page.$('[data-testid="tweetButtonInline"]');
  const fallbackButton = await page.$('[data-testid="tweetButton"]');
  const button = submitButton || fallbackButton;

  if (!button) {
    console.log('Кнопка отправки не найдена');
    return false;
  }

  const submitBox = await button.boundingBox();
  if (submitBox) {
    await humanMouseMove(page, submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2);
    await humanDelay(200, 400);
  }

  await button.click();
  await humanDelay(2000, 3000);

  console.log('Комментарий отправлен!');
  return true;
}

/**
 * Комментировать с рандомной стратегией
 */
export async function commentWithRandomStrategy(page, tweetUrl, tweetIndex, text) {
  const strategy = getRandomStrategy();

  console.log(`\n🎲 Выбрана стратегия: ${strategy}`);

  switch (strategy) {
    case 'fromFeed':
      return await commentFromFeed(page, tweetIndex, text);

    case 'fromTweetPage':
      return await commentFromTweetPage(page, tweetUrl, text);

    case 'fromInlineForm':
      return await commentFromInlineForm(page, tweetUrl, text);

    default:
      return await commentFromTweetPage(page, tweetUrl, text);
  }
}
