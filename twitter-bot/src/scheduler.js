import 'dotenv/config';
import cron from 'node-cron';
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { applyStealth } from './utils/stealth.js';
import { humanDelay } from './utils/humanize.js';
import { searchForTweet } from './actions/search-tweets.js';
import { likeTweetByUrl } from './actions/like.js';
import { processQueue } from './queue/task-runner.js';
import { printQueueStatus } from './queue/task-queue.js';

const config = {
  headless: process.env.HEADLESS !== 'false',
  sessionFile: 'twitter-session.json',

  // Расписание лайков
  cronLikes: process.env.CRON_LIKES || '0 */2 * * *', // Каждые 2 часа
  likeGoalPerRun: parseInt(process.env.LIKE_GOAL_PER_RUN, 10) || 5,
  targetUrl: process.env.TWITTER_LIST_URL || 'https://x.com/i/lists/1605837746580381696',
  searchKeywords: (process.env.SEARCH_KEYWORDS || 'gm').split(',').map(k => k.trim()),

  // Расписание очереди
  cronQueue: process.env.CRON_QUEUE || '0 * * * *', // Каждый час
  maxTasksPerRun: parseInt(process.env.MAX_TASKS_PER_RUN, 10) || 10,
};

const scheduledJobs = [];

/**
 * Создать браузер с авторизацией
 */
async function createAuthenticatedBrowser() {
  if (!existsSync(config.sessionFile)) {
    throw new Error('Сессия не найдена. Запусти: npm run login');
  }

  const sessionData = JSON.parse(readFileSync(config.sessionFile, 'utf-8'));

  const browser = await chromium.launch({
    headless: config.headless,
    channel: 'chrome',
    slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await applyStealth(context);
  await context.addCookies(sessionData.cookies);

  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * Задача: Лайкать твиты по ключевым словам
 */
async function likesJob() {
  console.log(`\n⏰ [${new Date().toLocaleString()}] Запуск задачи лайков...`);

  let browser;

  try {
    const { browser: b, page } = await createAuthenticatedBrowser();
    browser = b;

    // Проверяем авторизацию
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(3000, 4000);

    if (page.url().includes('/login')) {
      console.error('Сессия истекла!');
      return;
    }

    console.log('Авторизация OK');

    const likedUrls = new Set();
    let likesCount = 0;

    while (likesCount < config.likeGoalPerRun) {
      const foundTweet = await searchForTweet(page, config.searchKeywords, {
        maxScrolls: 30,
        excludeReplies: true,
        excludeRetweets: true,
        excludeUrls: likedUrls,
      });

      if (foundTweet && foundTweet.link) {
        likedUrls.add(foundTweet.link);
        const liked = await likeTweetByUrl(page, foundTweet.link);

        if (liked) {
          likesCount++;
          console.log(`❤️ Лайк #${likesCount}/${config.likeGoalPerRun}`);

          // Возвращаемся к листу
          if (likesCount < config.likeGoalPerRun) {
            await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });
            await humanDelay(3000, 4000);
          }
        }
      } else {
        console.log('Твит не найден, завершаю');
        break;
      }
    }

    console.log(`✅ Задача лайков завершена: ${likesCount} лайков`);

  } catch (error) {
    console.error('Ошибка в задаче лайков:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Задача: Обработать очередь
 */
async function queueJob() {
  console.log(`\n⏰ [${new Date().toLocaleString()}] Запуск обработки очереди...`);

  try {
    await processQueue({ maxTasks: config.maxTasksPerRun });
  } catch (error) {
    console.error('Ошибка обработки очереди:', error.message);
  }
}

/**
 * Запустить планировщик
 */
export function startScheduler() {
  console.log('🚀 Запуск планировщика...\n');

  // Валидация cron выражений
  if (!cron.validate(config.cronLikes)) {
    console.error(`Неверное cron выражение для лайков: ${config.cronLikes}`);
    process.exit(1);
  }

  if (!cron.validate(config.cronQueue)) {
    console.error(`Неверное cron выражение для очереди: ${config.cronQueue}`);
    process.exit(1);
  }

  // Задача лайков
  const likesTask = cron.schedule(config.cronLikes, likesJob, {
    scheduled: true,
    timezone: 'America/New_York',
  });
  scheduledJobs.push(likesTask);
  console.log(`📅 Лайки: ${config.cronLikes}`);
  console.log(`   Цель: ${config.likeGoalPerRun} лайков за запуск`);
  console.log(`   Ключевые слова: ${config.searchKeywords.join(', ')}\n`);

  // Задача очереди
  const queueTask = cron.schedule(config.cronQueue, queueJob, {
    scheduled: true,
    timezone: 'America/New_York',
  });
  scheduledJobs.push(queueTask);
  console.log(`📅 Очередь: ${config.cronQueue}`);
  console.log(`   Макс задач: ${config.maxTasksPerRun}\n`);

  // Показываем текущий статус очереди
  printQueueStatus();

  console.log('✅ Планировщик запущен. Нажми Ctrl+C для остановки.\n');

  // Обработка завершения
  process.on('SIGINT', () => {
    console.log('\n🛑 Останавливаю планировщик...');
    stopScheduler();
    process.exit(0);
  });
}

/**
 * Остановить планировщик
 */
export function stopScheduler() {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs.length = 0;
  console.log('Планировщик остановлен');
}

/**
 * Запустить задачу вручную
 */
export async function runJobManually(jobName) {
  switch (jobName) {
    case 'likes':
      await likesJob();
      break;
    case 'queue':
      await queueJob();
      break;
    default:
      console.log(`Неизвестная задача: ${jobName}`);
      console.log('Доступные: likes, queue');
  }
}

// CLI запуск
if (process.argv[1].includes('scheduler')) {
  const command = process.argv[2];

  if (command === 'run') {
    // Запустить конкретную задачу: node src/scheduler.js run likes
    const jobName = process.argv[3];
    runJobManually(jobName).then(() => process.exit(0));
  } else {
    // Запустить планировщик
    startScheduler();
  }
}
