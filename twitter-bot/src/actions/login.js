import { humanDelay } from '../utils/humanize.js';

/**
 * Логин в Twitter
 * @param {import('playwright').Page} page
 * @param {string} username
 * @param {string} password
 */
export async function login(page, username, password) {
  console.log('Открываю страницу логина...');

  // Увеличенный timeout и не ждём полной загрузки
  await page.goto('https://x.com/i/flow/login', {
    timeout: 60000,
    waitUntil: 'domcontentloaded'
  });

  console.log('Страница загружена, жду появления формы...');
  await humanDelay(3000, 5000);

  // === ВВОД USERNAME ===
  console.log('Ввожу username...');

  const usernameSelectors = [
    'input[autocomplete="username"]',
    'input[name="text"]',
    'input[type="text"]',
  ];

  let usernameInput = null;
  for (const selector of usernameSelectors) {
    try {
      usernameInput = await page.waitForSelector(selector, { timeout: 10000 });
      if (usernameInput) {
        console.log(`  Найден селектор: ${selector}`);
        break;
      }
    } catch (e) {
      console.log(`  Селектор ${selector} не найден...`);
    }
  }

  if (!usernameInput) {
    // Делаем скриншот для отладки
    await page.screenshot({ path: 'debug-login.png' });
    throw new Error('Не удалось найти поле username. Скриншот сохранён в debug-login.png');
  }

  await usernameInput.click();
  await humanDelay(300, 500);
  await usernameInput.fill(username);
  console.log('  Username введён');
  await humanDelay(800, 1200);

  // === КНОПКА NEXT ===
  console.log('Нажимаю Next...');

  const nextSelectors = [
    'button:has-text("Next")',
    'button:has-text("Далее")',
    '[role="button"]:has-text("Next")',
    '[role="button"]:has-text("Далее")',
  ];

  let nextClicked = false;
  for (const selector of nextSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      nextClicked = true;
      console.log(`  Нажал: ${selector}`);
      break;
    } catch (e) {
      // продолжаем
    }
  }

  if (!nextClicked) {
    await page.keyboard.press('Enter');
    console.log('  Нажал Enter');
  }

  await humanDelay(3000, 5000);

  // === ПРОВЕРКА ПРОМЕЖУТОЧНЫХ ШАГОВ ===
  console.log('Проверяю промежуточные шаги...');

  // Twitter иногда просит подтвердить username/email/phone
  const verificationInput = await page.$('input[data-testid="ocfEnterTextTextInput"]');
  if (verificationInput) {
    console.log('Twitter запрашивает верификацию!');
    console.log('Открой браузер и посмотри что просит Twitter.');
    console.log('Скрипт будет ждать 60 секунд — введи данные вручную.');

    await page.screenshot({ path: 'debug-verification.png' });

    // Ждём пока пользователь введёт данные вручную
    await page.waitForSelector('input[name="password"], input[type="password"]', {
      timeout: 60000
    });
  }

  // === ВВОД ПАРОЛЯ ===
  console.log('Ищу поле пароля...');

  // Делаем скриншот чтобы видеть текущее состояние
  await page.screenshot({ path: 'debug-before-password.png' });
  console.log('  Скриншот: debug-before-password.png');

  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
  ];

  let passwordInput = null;
  for (const selector of passwordSelectors) {
    try {
      passwordInput = await page.waitForSelector(selector, { timeout: 15000 });
      if (passwordInput) {
        console.log(`  Найден селектор: ${selector}`);
        break;
      }
    } catch (e) {
      console.log(`  Селектор ${selector} не найден...`);
    }
  }

  if (!passwordInput) {
    await page.screenshot({ path: 'debug-password-not-found.png' });
    console.log('Поле пароля не найдено. Проверь скриншот: debug-password-not-found.png');
    console.log('Возможно Twitter просит верификацию — введи данные вручную в браузере.');
    console.log('Жду 60 секунд...');

    // Даём время на ручной ввод
    try {
      passwordInput = await page.waitForSelector('input[name="password"], input[type="password"]', {
        timeout: 60000
      });
    } catch (e) {
      throw new Error('Таймаут ожидания поля пароля. Проверь debug-password-not-found.png');
    }
  }

  await passwordInput.click();
  await humanDelay(300, 500);
  await passwordInput.fill(password);
  console.log('  Пароль введён');
  await humanDelay(800, 1200);

  // === КНОПКА LOGIN ===
  console.log('Нажимаю Log in...');

  const loginSelectors = [
    '[data-testid="LoginForm_Login_Button"]',
    'button:has-text("Log in")',
    'button:has-text("Войти")',
  ];

  let loginClicked = false;
  for (const selector of loginSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      loginClicked = true;
      console.log(`  Нажал: ${selector}`);
      break;
    } catch (e) {
      // продолжаем
    }
  }

  if (!loginClicked) {
    await page.keyboard.press('Enter');
    console.log('  Нажал Enter');
  }

  // === ЖДЁМ ГЛАВНУЮ ===
  console.log('Жду загрузки главной страницы...');

  try {
    await page.waitForSelector('[data-testid="AppTabBar_Home_Link"], [aria-label="Home"]', {
      timeout: 30000
    });
    console.log('Успешный логин!');
  } catch (e) {
    await page.screenshot({ path: 'debug-after-login.png' });
    throw new Error('Не удалось дождаться главной страницы. Скриншот: debug-after-login.png');
  }

  await humanDelay(2000, 4000);
}
