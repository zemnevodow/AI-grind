import { humanDelay, humanMouseMove, randomInt } from '../utils/humanize.js';

/**
 * Лайкнуть твит по индексу на странице
 */
export async function likeTweetByIndex(page, index = 0) {
  const tweets = await page.$$('article[data-testid="tweet"]');

  if (index >= tweets.length) {
    console.log(`Твит с индексом ${index} не найден`);
    return false;
  }

  const tweet = tweets[index];

  // Находим кнопку лайка
  const likeButton = await tweet.$('[data-testid="like"]');

  if (!likeButton) {
    // Возможно уже лайкнут — проверяем unlike
    const unlikeButton = await tweet.$('[data-testid="unlike"]');
    if (unlikeButton) {
      console.log('Твит уже лайкнут');
      return true;
    }
    console.log('Кнопка лайка не найдена');
    return false;
  }

  // Получаем позицию кнопки
  const box = await likeButton.boundingBox();
  if (!box) {
    console.log('Не удалось получить позицию кнопки');
    return false;
  }

  // Плавно двигаем мышь к кнопке
  const x = box.x + box.width / 2 + randomInt(-5, 5);
  const y = box.y + box.height / 2 + randomInt(-3, 3);

  console.log('Навожу на кнопку лайка...');
  await humanMouseMove(page, x, y);
  await humanDelay(300, 600);

  // Кликаем
  console.log('Лайкаю...');
  await likeButton.click();
  await humanDelay(500, 1000);

  console.log('Лайк поставлен!');
  return true;
}

/**
 * Лайкнуть твит, найденный через поиск
 * Ищет твит по тексту и лайкает его
 */
export async function likeTweetByText(page, tweetText) {
  const tweets = await page.$$('article[data-testid="tweet"]');

  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    const textEl = await tweet.$('[data-testid="tweetText"]');

    if (textEl) {
      const text = await textEl.innerText();
      if (text.includes(tweetText.substring(0, 50))) {
        console.log(`Найден твит для лайка (индекс ${i})`);
        return await likeTweetByIndex(page, i);
      }
    }
  }

  console.log('Твит для лайка не найден на странице');
  return false;
}

/**
 * Лайкнуть твит по ссылке
 * Переходит на страницу твита и лайкает
 */
export async function likeTweetByUrl(page, tweetUrl) {
  console.log(`Открываю твит: ${tweetUrl}`);

  await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(2000, 3000);

  // Ищем основной твит (первый article)
  const tweet = await page.$('article[data-testid="tweet"]');

  if (!tweet) {
    console.log('Твит не найден на странице');
    return false;
  }

  // Находим кнопку лайка
  const likeButton = await tweet.$('[data-testid="like"]');

  if (!likeButton) {
    const unlikeButton = await tweet.$('[data-testid="unlike"]');
    if (unlikeButton) {
      console.log('Твит уже лайкнут');
      return true;
    }
    console.log('Кнопка лайка не найдена');
    return false;
  }

  // Плавно двигаем мышь и кликаем
  const box = await likeButton.boundingBox();
  if (box) {
    const x = box.x + box.width / 2 + randomInt(-5, 5);
    const y = box.y + box.height / 2 + randomInt(-3, 3);

    console.log('Навожу на кнопку лайка...');
    await humanMouseMove(page, x, y);
    await humanDelay(300, 600);
  }

  console.log('Лайкаю...');
  await likeButton.click();
  await humanDelay(500, 1000);

  console.log('Лайк поставлен!');
  return true;
}
