import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { applyStealth } from './utils/stealth.js';

const REMOTE_DEBUG_PORT = 9223;

async function testStealth() {
  console.log('Тест stealth режима\n');
  console.log('Метод: запуск обычного Chrome (не через Playwright)\n');

  // Закрываем процесс на порту (безопасный способ без shell)
  try {
    const lsofResult = spawnSync('lsof', ['-ti', `:${REMOTE_DEBUG_PORT}`], { encoding: 'utf-8' });
    if (lsofResult.stdout) {
      const pids = lsofResult.stdout.trim().split('\n').filter(Boolean);
      pids.forEach(pid => {
        spawnSync('kill', ['-9', pid], { stdio: 'ignore' });
      });
    }
  } catch (e) {}

  await sleep(500);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const tempProfile = join(homedir(), '.stealth-test-profile');

  console.log('Запускаю Chrome напрямую...');

  // Запускаем ОБЫЧНЫЙ Chrome (не через Playwright!)
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--safebrowsing-disable-auto-update',
    '--window-size=1280,900',
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chromeProcess.unref();

  // Ждём запуска
  await sleep(2000);

  console.log('Подключаюсь к Chrome через CDP...');

  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${REMOTE_DEBUG_PORT}`);
    const context = browser.contexts()[0];

    // Применяем stealth патчи (на всякий случай)
    await applyStealth(context);

    const page = context.pages()[0] || await context.newPage();

    console.log('Открываю bot.sannysoft.com...\n');
    await page.goto('https://bot.sannysoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(4000);

    // Проверяем WebDriver напрямую
    const webdriverValue = await page.evaluate(() => navigator.webdriver);
    console.log(`navigator.webdriver = ${webdriverValue}\n`);

    // Делаем скриншот
    await page.screenshot({ path: 'stealth-test-result.png', fullPage: true });
    console.log('Скриншот: stealth-test-result.png\n');

    // Собираем результаты
    console.log('Результаты тестов:');
    console.log('='.repeat(50));

    const results = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      const data = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const test = cells[0].textContent.trim();
          const result = cells[1].textContent.trim();
          const classList = cells[1].className;
          const passed = classList.includes('passed') ||
                        (!classList.includes('failed') && !result.includes('failed'));
          data.push({ test, result, passed });
        }
      });
      return data;
    });

    let passed = 0;
    let failed = 0;

    results.forEach(r => {
      const status = r.passed ? '✅' : '❌';
      console.log(`${status} ${r.test}: ${r.result}`);
      if (r.passed) passed++;
      else failed++;
    });

    console.log('='.repeat(50));
    console.log(`\nИтого: ${passed} passed, ${failed} failed`);

    console.log('\nБраузер открыт. Ctrl+C чтобы закрыть.\n');

    await new Promise(() => {});

  } catch (e) {
    console.error('Ошибка:', e.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testStealth().catch(console.error);
