/**
 * Утилиты для имитации человеческого поведения
 */

// Случайное число в диапазоне
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Случайное дробное число
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Случайная пауза
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Человеческая пауза (случайная в диапазоне)
export function humanDelay(minMs = 1000, maxMs = 3000) {
  return sleep(randomInt(minMs, maxMs));
}

// Имитация печати текста с задержкой между символами
export async function humanType(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(randomInt(50, 150));
  }
}

/**
 * Генерация точек кривой Безье для естественного движения мыши
 */
function bezierCurve(start, end, control1, control2, steps) {
  const points = [];
  for (let t = 0; t <= 1; t += 1 / steps) {
    const x = Math.pow(1 - t, 3) * start.x +
              3 * Math.pow(1 - t, 2) * t * control1.x +
              3 * (1 - t) * Math.pow(t, 2) * control2.x +
              Math.pow(t, 3) * end.x;
    const y = Math.pow(1 - t, 3) * start.y +
              3 * Math.pow(1 - t, 2) * t * control1.y +
              3 * (1 - t) * Math.pow(t, 2) * control2.y +
              Math.pow(t, 3) * end.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

/**
 * Плавное движение мыши по кривой Безье (как человек)
 */
export async function humanMouseMove(page, toX, toY, options = {}) {
  const { steps = randomInt(20, 40), startX, startY } = options;

  // Получаем текущую позицию или используем переданную
  const viewport = page.viewportSize();
  const fromX = startX ?? randomInt(0, viewport?.width || 1280);
  const fromY = startY ?? randomInt(0, viewport?.height || 800);

  // Генерируем контрольные точки для кривой Безье
  const control1 = {
    x: fromX + (toX - fromX) * randomFloat(0.2, 0.4) + randomInt(-50, 50),
    y: fromY + (toY - fromY) * randomFloat(0.2, 0.4) + randomInt(-50, 50),
  };
  const control2 = {
    x: fromX + (toX - fromX) * randomFloat(0.6, 0.8) + randomInt(-50, 50),
    y: fromY + (toY - fromY) * randomFloat(0.6, 0.8) + randomInt(-50, 50),
  };

  // Генерируем точки кривой
  const points = bezierCurve(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    control1,
    control2,
    steps
  );

  // Двигаем мышь по точкам
  for (const point of points) {
    await page.mouse.move(point.x, point.y);
    // Небольшая случайная задержка между движениями
    await sleep(randomInt(5, 20));
  }
}

/**
 * Случайное движение мыши в области экрана
 */
export async function randomMouseMove(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };
  const x = randomInt(100, viewport.width - 100);
  const y = randomInt(100, viewport.height - 100);
  await humanMouseMove(page, x, y);
}

/**
 * Навести мышь на элемент (hover)
 */
export async function hoverElement(page, selector) {
  try {
    const element = await page.$(selector);
    if (element) {
      const box = await element.boundingBox();
      if (box) {
        // Двигаем к случайной точке внутри элемента
        const x = box.x + randomInt(5, box.width - 5);
        const y = box.y + randomInt(5, box.height - 5);
        await humanMouseMove(page, x, y);
        return true;
      }
    }
  } catch (e) {
    // Элемент не найден
  }
  return false;
}

/**
 * Навести на случайный твит в ленте
 */
export async function hoverRandomTweet(page) {
  const tweets = await page.$$('article[data-testid="tweet"]');
  if (tweets.length > 0) {
    const randomTweet = tweets[randomInt(0, Math.min(tweets.length - 1, 5))];
    const box = await randomTweet.boundingBox();
    if (box && box.y > 0 && box.y < 700) { // Только видимые твиты
      const x = box.x + randomInt(50, box.width - 50);
      const y = box.y + randomInt(20, box.height - 20);
      await humanMouseMove(page, x, y);
      await humanDelay(500, 1500); // Задержка на "чтение"
      return true;
    }
  }
  return false;
}

/**
 * Симуляция движения глаз — мышь следует за "взглядом"
 */
export async function simulateReading(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };

  // Несколько точек "чтения" слева направо, сверху вниз
  const readingPoints = [
    { x: randomInt(200, 400), y: randomInt(200, 250) },
    { x: randomInt(500, 700), y: randomInt(200, 250) },
    { x: randomInt(200, 400), y: randomInt(300, 350) },
    { x: randomInt(500, 800), y: randomInt(300, 350) },
    { x: randomInt(200, 400), y: randomInt(400, 450) },
  ];

  for (const point of readingPoints) {
    if (Math.random() > 0.3) { // Не все точки
      await humanMouseMove(page, point.x, point.y);
      await humanDelay(200, 600);
    }
  }
}

/**
 * Случайные микро-движения мыши (человек не держит мышь идеально неподвижно)
 */
export async function microMovements(page, duration = 2000) {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };
  const startTime = Date.now();
  let lastX = randomInt(300, viewport.width - 300);
  let lastY = randomInt(200, viewport.height - 200);

  await page.mouse.move(lastX, lastY);

  while (Date.now() - startTime < duration) {
    // Маленькие случайные отклонения
    lastX += randomInt(-3, 3);
    lastY += randomInt(-3, 3);
    await page.mouse.move(lastX, lastY);
    await sleep(randomInt(50, 150));
  }
}

/**
 * Имитация "чтения" конкретного твита
 * - Скролл к твиту
 * - Hover на твит
 * - Движение глаз по тексту
 * - Случайные микро-движения
 * - Случайная длительность в зависимости от длины текста
 *
 * @param {Page} page
 * @param {ElementHandle} tweetElement - article элемент
 * @param {Object} options
 */
export async function simulateTweetReading(page, tweetElement, options = {}) {
  const {
    minReadTime = 2000,
    maxReadTime = 6000,
    textLengthFactor = 50, // +50ms за каждые 100 символов
  } = options;

  try {
    // Скроллим к твиту
    await tweetElement.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await humanDelay(500, 800);

    const box = await tweetElement.boundingBox();
    if (!box) return;

    // 1. Наводим мышь на начало твита (слева-сверху текста)
    const startX = box.x + randomInt(50, 100);
    const startY = box.y + randomInt(30, 60);
    await humanMouseMove(page, startX, startY);
    await humanDelay(300, 600);

    // 2. Получаем длину текста для расчета времени чтения
    const textLength = await tweetElement.evaluate(el => {
      const textEl = el.querySelector('[data-testid="tweetText"]');
      return textEl ? textEl.innerText.length : 0;
    });

    // 3. Рассчитываем время чтения
    const baseTime = randomInt(minReadTime, maxReadTime);
    const extraTime = Math.floor(textLength / 100) * textLengthFactor;
    const totalReadTime = Math.min(baseTime + extraTime, 10000); // max 10 sec

    // 4. Симулируем движение глаз (мышь следует за взглядом)
    const readingSteps = randomInt(3, 6);
    const stepDuration = totalReadTime / readingSteps;

    for (let i = 0; i < readingSteps; i++) {
      // Движение слева направо, сверху вниз
      const progress = (i + 1) / readingSteps;
      const targetX = box.x + (box.width * 0.2) + (box.width * 0.6 * Math.random());
      const targetY = box.y + (box.height * progress * 0.7);

      await humanMouseMove(page, targetX, targetY);
      await humanDelay(stepDuration * 0.5, stepDuration * 1.5);

      // Иногда микро-движения (дрожание руки)
      if (Math.random() < 0.3) {
        await page.mouse.move(targetX + randomInt(-5, 5), targetY + randomInt(-3, 3));
        await humanDelay(50, 150);
      }
    }

    // 5. Финальная пауза (как будто осмысливаем)
    await humanDelay(500, 1500);

  } catch (e) {
    // Элемент мог уйти из viewport - игнорируем
  }
}

/**
 * Имитация просмотра ленты с чтением случайных твитов
 * @param {Page} page
 * @param {number} tweetCount - сколько твитов "прочитать"
 */
export async function simulateFeedBrowsing(page, tweetCount = 3) {
  const tweets = await page.$$('article[data-testid="tweet"]');
  const visibleTweets = [];

  // Находим видимые твиты
  for (const tweet of tweets) {
    const box = await tweet.boundingBox();
    if (box && box.y > 0 && box.y < 700) {
      visibleTweets.push(tweet);
    }
  }

  if (visibleTweets.length === 0) return;

  // Выбираем случайные твиты для чтения
  const toRead = Math.min(tweetCount, visibleTweets.length);
  const indices = [];

  while (indices.length < toRead && indices.length < visibleTweets.length) {
    const idx = randomInt(0, visibleTweets.length - 1);
    if (!indices.includes(idx)) {
      indices.push(idx);
    }
  }

  // Сортируем чтобы читать сверху вниз (как человек)
  indices.sort((a, b) => a - b);

  for (const idx of indices) {
    await simulateTweetReading(page, visibleTweets[idx]);

    // Иногда небольшой скролл между чтением
    if (Math.random() < 0.4) {
      await page.mouse.wheel(0, randomInt(50, 150));
      await humanDelay(300, 600);
    }
  }
}
