import { humanDelay, humanMouseMove, randomInt } from '../utils/humanize.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const FOLLOW_LOG_FILE = 'follow-log.json';

/**
 * Загрузить лог подписок
 */
export function loadFollowLog() {
  if (!existsSync(FOLLOW_LOG_FILE)) {
    return { follows: [], unfollows: [], dailyCount: 0, lastReset: new Date().toDateString() };
  }

  try {
    const data = JSON.parse(readFileSync(FOLLOW_LOG_FILE, 'utf-8'));

    // Сброс дневного счётчика
    if (data.lastReset !== new Date().toDateString()) {
      data.dailyCount = 0;
      data.lastReset = new Date().toDateString();
    }

    return data;
  } catch (e) {
    return { follows: [], unfollows: [], dailyCount: 0, lastReset: new Date().toDateString() };
  }
}

/**
 * Сохранить лог подписок
 */
export function saveFollowLog(log) {
  writeFileSync(FOLLOW_LOG_FILE, JSON.stringify(log, null, 2));
}

/**
 * Проверить дневной лимит
 */
export function checkDailyLimit(log, limit = 50) {
  return log.dailyCount < limit;
}

/**
 * Получить статус подписки на странице профиля
 */
export async function getFollowStatus(page) {
  // Ищем кнопку Follow или Following
  const followButton = await page.$('[data-testid$="-follow"]');
  const unfollowButton = await page.$('[data-testid$="-unfollow"]');

  if (unfollowButton) {
    return 'following';
  }
  if (followButton) {
    return 'not_following';
  }

  return 'unknown';
}

/**
 * Подписаться на пользователя по username
 */
export async function followByUsername(page, username, options = {}) {
  const cleanUsername = username.replace('@', '');
  const profileUrl = `https://x.com/${cleanUsername}`;
  return await followUser(page, profileUrl, options);
}

/**
 * Подписаться на пользователя по URL профиля
 */
export async function followUser(page, profileUrl, options = {}) {
  const {
    dailyLimit = parseInt(process.env.FOLLOW_DAILY_LIMIT, 10) || 50,
    logActions = true,
  } = options;

  const log = loadFollowLog();

  // Проверяем лимит
  if (!checkDailyLimit(log, dailyLimit)) {
    console.log(`Достигнут дневной лимит подписок (${dailyLimit})`);
    return { success: false, reason: 'daily_limit' };
  }

  console.log(`Открываю профиль: ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  // Проверяем текущий статус
  const status = await getFollowStatus(page);
  console.log(`Текущий статус: ${status}`);

  if (status === 'following') {
    console.log('Уже подписан на этого пользователя');
    return { success: true, reason: 'already_following' };
  }

  if (status === 'unknown') {
    console.log('Не удалось определить статус подписки');
    return { success: false, reason: 'unknown_status' };
  }

  // Находим кнопку Follow
  const followButton = await page.$('[data-testid$="-follow"]');

  if (!followButton) {
    console.log('Кнопка Follow не найдена');
    return { success: false, reason: 'button_not_found' };
  }

  // Наводим мышь и кликаем
  const box = await followButton.boundingBox();
  if (box) {
    const x = box.x + box.width / 2 + randomInt(-5, 5);
    const y = box.y + box.height / 2 + randomInt(-3, 3);

    console.log('Навожу на кнопку Follow...');
    await humanMouseMove(page, x, y);
    await humanDelay(300, 500);
  }

  console.log('Подписываюсь...');
  await followButton.click();
  await humanDelay(1000, 1500);

  // Проверяем результат
  const newStatus = await getFollowStatus(page);

  if (newStatus === 'following') {
    console.log('Подписка успешна!');

    if (logActions) {
      log.follows.push({
        url: profileUrl,
        timestamp: new Date().toISOString(),
      });
      log.dailyCount++;
      saveFollowLog(log);
    }

    return { success: true, reason: 'followed' };
  }

  console.log('Не удалось подписаться');
  return { success: false, reason: 'follow_failed' };
}

/**
 * Отписаться от пользователя по username
 */
export async function unfollowByUsername(page, username, options = {}) {
  const cleanUsername = username.replace('@', '');
  const profileUrl = `https://x.com/${cleanUsername}`;
  return await unfollowUser(page, profileUrl, options);
}

/**
 * Отписаться от пользователя по URL профиля
 */
export async function unfollowUser(page, profileUrl, options = {}) {
  const {
    dailyLimit = parseInt(process.env.UNFOLLOW_DAILY_LIMIT, 10) || 50,
    logActions = true,
  } = options;

  const log = loadFollowLog();

  // Проверяем лимит (используем общий счётчик)
  if (!checkDailyLimit(log, dailyLimit)) {
    console.log(`Достигнут дневной лимит отписок (${dailyLimit})`);
    return { success: false, reason: 'daily_limit' };
  }

  console.log(`Открываю профиль: ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  // Проверяем текущий статус
  const status = await getFollowStatus(page);
  console.log(`Текущий статус: ${status}`);

  if (status === 'not_following') {
    console.log('Не подписан на этого пользователя');
    return { success: true, reason: 'not_following' };
  }

  if (status === 'unknown') {
    console.log('Не удалось определить статус подписки');
    return { success: false, reason: 'unknown_status' };
  }

  // Находим кнопку Following (для отписки)
  const unfollowButton = await page.$('[data-testid$="-unfollow"]');

  if (!unfollowButton) {
    console.log('Кнопка Following не найдена');
    return { success: false, reason: 'button_not_found' };
  }

  // Наводим мышь и кликаем
  const box = await unfollowButton.boundingBox();
  if (box) {
    const x = box.x + box.width / 2 + randomInt(-5, 5);
    const y = box.y + box.height / 2 + randomInt(-3, 3);

    console.log('Навожу на кнопку Following...');
    await humanMouseMove(page, x, y);
    await humanDelay(300, 500);
  }

  console.log('Кликаю для отписки...');
  await unfollowButton.click();
  await humanDelay(500, 800);

  // Ждём модалку подтверждения
  const confirmButton = await page.$('[data-testid="confirmationSheetConfirm"]');

  if (confirmButton) {
    // Наводим мышь на кнопку подтверждения
    const confirmBox = await confirmButton.boundingBox();
    if (confirmBox) {
      console.log('Навожу на кнопку подтверждения...');
      await humanMouseMove(page, confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2);
      await humanDelay(200, 400);
    }

    console.log('Подтверждаю отписку...');
    await confirmButton.click();
    await humanDelay(1000, 1500);
  }

  // Проверяем результат
  const newStatus = await getFollowStatus(page);

  if (newStatus === 'not_following') {
    console.log('Отписка успешна!');

    if (logActions) {
      log.unfollows.push({
        url: profileUrl,
        timestamp: new Date().toISOString(),
      });
      log.dailyCount++;
      saveFollowLog(log);
    }

    return { success: true, reason: 'unfollowed' };
  }

  console.log('Не удалось отписаться');
  return { success: false, reason: 'unfollow_failed' };
}

/**
 * Получить статистику подписок
 */
export function getFollowStats() {
  const log = loadFollowLog();
  return {
    totalFollows: log.follows.length,
    totalUnfollows: log.unfollows.length,
    todayActions: log.dailyCount,
    lastReset: log.lastReset,
  };
}
