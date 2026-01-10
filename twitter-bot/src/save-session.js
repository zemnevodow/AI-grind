import 'dotenv/config';
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Запускаем ОБЫЧНЫЙ Chrome (не через Playwright) и подключаемся к нему.
 * Никакого сообщения об автоматизации!
 */

const REMOTE_DEBUG_PORT = 9222;

async function saveSession() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Запускаю обычный Chrome (без флага автоматизации)');
  console.log('='.repeat(60));
  console.log('');

  // Закрываем Chrome если открыт (безопасный способ без shell)
  try {
    spawnSync('pkill', ['-f', 'Google Chrome'], { stdio: 'ignore' });
    await sleep(1000);
  } catch (e) {
    // Chrome не был запущен
  }

  // Путь к Chrome на Mac
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  if (!existsSync(chromePath)) {
    console.error('Chrome не найден:', chromePath);
    process.exit(1);
  }

  // Временный профиль для сессии
  const tempProfile = join(homedir(), '.twitter-bot-chrome-profile');

  console.log('Запускаю Chrome с remote debugging...');

  // Запускаем Chrome как обычный процесс (НЕ через Playwright!)
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'https://x.com/login'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chromeProcess.unref();

  console.log('Chrome запущен!');
  console.log('');
  console.log('1. Залогинься в Twitter (Google OAuth работает!)');
  console.log('2. Дождись загрузки ленты');
  console.log('3. Вернись сюда и нажми Enter');
  console.log('');

  // Ждём ввода пользователя
  await waitForEnter();

  console.log('Подключаюсь к Chrome...');

  try {
    // Подключаемся к запущенному Chrome
    const browser = await chromium.connectOverCDP(`http://localhost:${REMOTE_DEBUG_PORT}`);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error('Нет контекстов браузера');
    }

    const context = contexts[0];
    const pages = context.pages();
    const page = pages.find(p => p.url().includes('x.com') || p.url().includes('twitter.com'));

    if (!page) {
      throw new Error('Страница Twitter не найдена. Открой Twitter в браузере.');
    }

    console.log('Страница найдена:', page.url());

    // Проверяем что залогинены
    const isLoggedIn = await page.$('[data-testid="AppTabBar_Home_Link"]');

    if (!isLoggedIn) {
      console.error('Ты не залогинен в Twitter!');
      console.log('Залогинься и попробуй снова.');
      await browser.close();
      process.exit(1);
    }

    console.log('Сохраняю cookies...');

    // Получаем cookies
    const cookies = await context.cookies();
    const twitterCookies = cookies.filter(c =>
      c.domain.includes('x.com') || c.domain.includes('twitter.com')
    );

    const sessionData = {
      cookies: twitterCookies,
      savedAt: new Date().toISOString(),
    };

    writeFileSync('twitter-session.json', JSON.stringify(sessionData, null, 2));

    console.log('');
    console.log('='.repeat(60));
    console.log(`  Сохранено ${twitterCookies.length} cookies`);
    console.log('  Файл: twitter-session.json');
    console.log('');
    console.log('  Теперь запускай: npm run start:visible');
    console.log('='.repeat(60));

    await browser.close();

  } catch (e) {
    console.error('Ошибка:', e.message);
    console.log('');
    console.log('Убедись что:');
    console.log('1. Chrome открыт');
    console.log('2. Ты залогинен в Twitter');
    console.log('3. Лента загружена');
  }

  // Закрываем Chrome (безопасный способ без shell)
  try {
    spawnSync('pkill', ['-f', 'Google Chrome'], { stdio: 'ignore' });
  } catch (e) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdout.write('Нажми Enter когда залогинишься... ');
    process.stdin.once('data', () => resolve());
  });
}

saveSession();
