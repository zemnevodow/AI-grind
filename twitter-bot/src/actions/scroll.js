import {
  humanDelay,
  randomInt,
  randomMouseMove,
  hoverRandomTweet,
  simulateReading,
  microMovements,
  humanMouseMove,
} from '../utils/humanize.js';

/**
 * Плавный скролл как человек (много маленьких движений)
 */
async function smoothScroll(page, distance) {
  const steps = randomInt(15, 25);
  const baseStep = distance / steps;

  for (let i = 0; i < steps; i++) {
    const variation = randomInt(-3, 3);
    const stepDistance = baseStep + variation;
    await page.mouse.wheel(0, stepDistance);
    await page.waitForTimeout(randomInt(10, 30));
  }
}

/**
 * Скроллинг ленты Twitter с человеческим поведением
 */
export async function scrollFeed(page, options = {}) {
  const {
    scrollCount = 50,
    minPause = 2000,
    maxPause = 5000,
    readChance = 0.3,
  } = options;

  console.log(`Начинаю скроллинг ленты (${scrollCount} скроллов)...`);

  // Начальное движение мыши в область ленты
  await humanMouseMove(page, randomInt(400, 800), randomInt(300, 500));
  await page.waitForTimeout(1000);

  for (let i = 0; i < scrollCount; i++) {
    const scrollDistance = randomInt(300, 600);

    // Плавный скролл
    await smoothScroll(page, scrollDistance);

    // Базовая пауза
    await humanDelay(minPause, maxPause);

    // Случайные действия между скроллами
    const action = Math.random();

    if (action < readChance) {
      // "Читаем" пост — наводим мышь и задерживаемся
      console.log(`  [${i + 1}/${scrollCount}] Читаю пост...`);
      await hoverRandomTweet(page);
      await simulateReading(page);
      await humanDelay(3000, 8000);

    } else if (action < readChance + 0.15) {
      // Просто двигаем мышь случайно
      console.log(`  [${i + 1}/${scrollCount}] Скролл + движение мыши`);
      await randomMouseMove(page);
      await humanDelay(500, 1000);

    } else if (action < readChance + 0.25) {
      // Микро-движения (мышь слегка дрожит)
      console.log(`  [${i + 1}/${scrollCount}] Скролл + микро-движения`);
      await microMovements(page, randomInt(1000, 2000));

    } else {
      // Просто скролл
      console.log(`  [${i + 1}/${scrollCount}] Скролл...`);
    }

    // Иногда скроллим немного вверх (как человек)
    if (Math.random() < 0.08) {
      console.log(`  [${i + 1}/${scrollCount}] Скролл вверх...`);
      await smoothScroll(page, -randomInt(80, 200));
      await humanDelay(500, 1500);
    }

    // Иногда делаем более длинную паузу
    if (Math.random() < 0.1) {
      console.log(`  [${i + 1}/${scrollCount}] Длинная пауза...`);
      await humanDelay(5000, 10000);
    }
  }

  console.log('Скроллинг завершён!');
}

/**
 * Скроллинг по времени
 */
export async function scrollForDuration(page, durationMinutes = 30) {
  const endTime = Date.now() + durationMinutes * 60 * 1000;
  let scrollNumber = 0;

  console.log(`Скроллинг на ${durationMinutes} минут...`);

  // Начальное движение мыши
  await humanMouseMove(page, randomInt(400, 800), randomInt(300, 500));

  while (Date.now() < endTime) {
    scrollNumber++;
    const scrollDistance = randomInt(300, 600);

    await smoothScroll(page, scrollDistance);

    // Случайные действия
    const action = Math.random();

    if (action < 0.25) {
      await hoverRandomTweet(page);
      await humanDelay(2000, 5000);
    } else if (action < 0.35) {
      await randomMouseMove(page);
      await humanDelay(500, 1000);
    } else if (action < 0.45) {
      await microMovements(page, randomInt(1000, 3000));
    }

    // Пауза между скроллами
    const pauseTime = randomInt(3000, 8000);

    if (scrollNumber % 10 === 0) {
      console.log(`  [${scrollNumber}] Длинная пауза...`);
      await humanDelay(10000, 20000);
    } else {
      await humanDelay(pauseTime, pauseTime + 2000);
    }

    // Иногда возвращаемся наверх
    if (Math.random() < 0.03) {
      console.log(`  [${scrollNumber}] Возвращаюсь наверх...`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await humanDelay(2000, 4000);
      await randomMouseMove(page);
    }

    const remainingMinutes = Math.round((endTime - Date.now()) / 60000);
    if (scrollNumber % 15 === 0) {
      console.log(`  Осталось ${remainingMinutes} минут`);
    }
  }

  console.log(`Готово! Выполнено ${scrollNumber} скроллов.`);
}
