import 'dotenv/config';
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { applyStealth } from '../utils/stealth.js';
import { humanDelay } from '../utils/humanize.js';
import { likeTweetByUrl } from '../actions/like.js';
import { commentByUrl, loadCommentTemplates, getRandomComment } from '../actions/comment.js';
import { followUser, unfollowUser } from '../actions/follow.js';
import {
  getNextPendingTask,
  getPendingTasks,
  markTaskInProgress,
  markTaskCompleted,
  markTaskFailed,
  printQueueStatus,
} from './task-queue.js';

const config = {
  headless: process.env.HEADLESS !== 'false',
  sessionFile: 'twitter-session.json',
  delayBetweenTasks: parseInt(process.env.TASK_DELAY, 10) || 5000, // 5 сек между задачами
  maxTasksPerRun: parseInt(process.env.MAX_TASKS_PER_RUN, 10) || 10,
};

/**
 * Выполнить одну задачу
 */
async function executeTask(page, task) {
  console.log(`\n🔄 Выполняю: ${task.type} -> ${task.target}`);

  try {
    let success = false;

    switch (task.type) {
      case 'like':
        success = await likeTweetByUrl(page, task.target);
        break;

      case 'comment':
        let commentText = task.params.text;

        // Если текст не указан, используем шаблон
        if (!commentText) {
          const templates = loadCommentTemplates();
          commentText = getRandomComment(templates, task.params);
        }

        success = await commentByUrl(page, task.target, commentText);
        break;

      case 'follow':
        const followResult = await followUser(page, task.target);
        success = followResult.success;
        break;

      case 'unfollow':
        const unfollowResult = await unfollowUser(page, task.target);
        success = unfollowResult.success;
        break;

      default:
        console.log(`Неизвестный тип задачи: ${task.type}`);
        markTaskFailed(task.id, `Unknown task type: ${task.type}`);
        return false;
    }

    if (success) {
      markTaskCompleted(task.id);
      console.log(`✅ Задача выполнена: ${task.id}`);
      return true;
    } else {
      markTaskFailed(task.id, 'Task execution returned false');
      console.log(`❌ Задача не выполнена: ${task.id}`);
      return false;
    }

  } catch (error) {
    console.error(`Ошибка выполнения задачи: ${error.message}`);
    markTaskFailed(task.id, error.message);
    return false;
  }
}

/**
 * Обработать очередь задач
 */
export async function processQueue(options = {}) {
  const {
    maxTasks = config.maxTasksPerRun,
    delayBetweenTasks = config.delayBetweenTasks,
  } = options;

  // Проверяем наличие сессии
  if (!existsSync(config.sessionFile)) {
    console.error('Ошибка: Сессия не найдена!');
    console.log('Сначала залогинься: npm run login');
    process.exit(1);
  }

  // Показываем статус очереди
  printQueueStatus();

  const pendingTasks = getPendingTasks();

  if (pendingTasks.length === 0) {
    console.log('Нет задач для выполнения');
    return { completed: 0, failed: 0 };
  }

  console.log(`\n🚀 Запускаю обработку ${Math.min(pendingTasks.length, maxTasks)} задач...\n`);

  // Загружаем сессию
  const sessionData = JSON.parse(readFileSync(config.sessionFile, 'utf-8'));

  let browser;
  let completed = 0;
  let failed = 0;

  try {
    // Запускаем браузер
    browser = await chromium.launch({
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

    // Применяем stealth
    await applyStealth(context);

    // Загружаем cookies
    await context.addCookies(sessionData.cookies);

    const page = await context.newPage();

    // Проверяем авторизацию
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(3000, 4000);

    if (page.url().includes('/login')) {
      console.error('Сессия истекла. Перелогинься: npm run login');
      process.exit(1);
    }

    console.log('Авторизация OK\n');

    // Обрабатываем задачи
    let tasksProcessed = 0;

    while (tasksProcessed < maxTasks) {
      const task = getNextPendingTask();

      if (!task) {
        console.log('\nВсе pending задачи обработаны');
        break;
      }

      markTaskInProgress(task.id);

      const success = await executeTask(page, task);

      if (success) {
        completed++;
      } else {
        failed++;
      }

      tasksProcessed++;

      // Пауза между задачами
      if (tasksProcessed < maxTasks && getNextPendingTask()) {
        console.log(`\n⏳ Пауза ${delayBetweenTasks / 1000} сек...\n`);
        await humanDelay(delayBetweenTasks, delayBetweenTasks + 2000);
      }
    }

    console.log(`\n📊 Результат: ${completed} выполнено, ${failed} ошибок`);
    printQueueStatus();

  } catch (error) {
    console.error('Критическая ошибка:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return { completed, failed };
}

/**
 * Запустить следующую задачу из очереди (одну)
 */
export async function runNextTask() {
  return await processQueue({ maxTasks: 1 });
}

// CLI запуск
if (process.argv[1].includes('task-runner')) {
  const maxTasks = parseInt(process.argv[2]) || config.maxTasksPerRun;
  processQueue({ maxTasks }).then(() => process.exit(0));
}
