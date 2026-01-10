import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const TASKS_FILE = 'tasks.json';

/**
 * Загрузить задачи из файла
 */
export function loadTasks() {
  if (!existsSync(TASKS_FILE)) {
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
    return data.tasks || [];
  } catch (e) {
    console.error('Ошибка загрузки задач:', e.message);
    return [];
  }
}

/**
 * Сохранить задачи в файл
 */
export function saveTasks(tasks) {
  const data = {
    updatedAt: new Date().toISOString(),
    tasks,
  };
  writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Создать новую задачу
 * @param {string} type - Тип: like, comment, follow, unfollow
 * @param {string} target - URL или username
 * @param {object} params - Дополнительные параметры
 */
export function createTask(type, target, params = {}) {
  return {
    id: randomUUID(),
    type,
    target,
    params,
    status: 'pending',
    createdAt: new Date().toISOString(),
    executedAt: null,
    error: null,
    retries: 0,
  };
}

/**
 * Добавить задачу в очередь
 */
export function addTask(type, target, params = {}) {
  const tasks = loadTasks();
  const task = createTask(type, target, params);
  tasks.push(task);
  saveTasks(tasks);
  console.log(`Задача добавлена: ${type} -> ${target}`);
  return task;
}

/**
 * Добавить несколько задач
 */
export function addTasks(taskList) {
  const tasks = loadTasks();
  const newTasks = taskList.map(t => createTask(t.type, t.target, t.params || {}));
  tasks.push(...newTasks);
  saveTasks(tasks);
  console.log(`Добавлено ${newTasks.length} задач`);
  return newTasks;
}

/**
 * Получить следующую pending задачу
 */
export function getNextPendingTask() {
  const tasks = loadTasks();
  return tasks.find(t => t.status === 'pending');
}

/**
 * Получить все pending задачи
 */
export function getPendingTasks() {
  const tasks = loadTasks();
  return tasks.filter(t => t.status === 'pending');
}

/**
 * Обновить статус задачи
 */
export function updateTaskStatus(taskId, status, error = null) {
  const tasks = loadTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    console.log(`Задача ${taskId} не найдена`);
    return null;
  }

  tasks[taskIndex].status = status;
  tasks[taskIndex].executedAt = new Date().toISOString();

  if (error) {
    tasks[taskIndex].error = error;
    tasks[taskIndex].retries++;
  }

  saveTasks(tasks);
  return tasks[taskIndex];
}

/**
 * Отметить задачу как in_progress
 */
export function markTaskInProgress(taskId) {
  return updateTaskStatus(taskId, 'in_progress');
}

/**
 * Отметить задачу как completed
 */
export function markTaskCompleted(taskId) {
  return updateTaskStatus(taskId, 'completed');
}

/**
 * Отметить задачу как failed
 */
export function markTaskFailed(taskId, error) {
  return updateTaskStatus(taskId, 'failed', error);
}

/**
 * Сбросить failed задачи обратно в pending (для retry)
 */
export function retryFailedTasks(maxRetries = 3) {
  const tasks = loadTasks();
  let resetCount = 0;

  tasks.forEach(task => {
    if (task.status === 'failed' && task.retries < maxRetries) {
      task.status = 'pending';
      resetCount++;
    }
  });

  saveTasks(tasks);
  console.log(`Сброшено ${resetCount} задач для повторной попытки`);
  return resetCount;
}

/**
 * Удалить выполненные задачи
 */
export function clearCompletedTasks() {
  const tasks = loadTasks();
  const remaining = tasks.filter(t => t.status !== 'completed');
  const removed = tasks.length - remaining.length;
  saveTasks(remaining);
  console.log(`Удалено ${removed} выполненных задач`);
  return removed;
}

// Безопасные ключи для защиты от prototype pollution
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'failed'];
const VALID_TYPES = ['like', 'comment', 'follow', 'unfollow'];

/**
 * Получить статистику очереди
 */
export function getQueueStats() {
  const tasks = loadTasks();

  const stats = {
    total: tasks.length,
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    byType: Object.create(null), // Без prototype chain
  };

  tasks.forEach(task => {
    // Защита от prototype pollution
    if (VALID_STATUSES.includes(task.status)) {
      stats[task.status]++;
    }

    if (VALID_TYPES.includes(task.type)) {
      if (!stats.byType[task.type]) {
        stats.byType[task.type] = { pending: 0, completed: 0, failed: 0 };
      }
      if (VALID_STATUSES.includes(task.status)) {
        stats.byType[task.type][task.status]++;
      }
    }
  });

  return stats;
}

/**
 * Показать статус очереди
 */
export function printQueueStatus() {
  const stats = getQueueStats();

  console.log('\n📋 Статус очереди:');
  console.log(`   Всего: ${stats.total}`);
  console.log(`   ⏳ Pending: ${stats.pending}`);
  console.log(`   🔄 In Progress: ${stats.in_progress}`);
  console.log(`   ✅ Completed: ${stats.completed}`);
  console.log(`   ❌ Failed: ${stats.failed}`);

  if (Object.keys(stats.byType).length > 0) {
    console.log('\n   По типам:');
    for (const [type, typeStats] of Object.entries(stats.byType)) {
      console.log(`   - ${type}: ${typeStats.pending} pending, ${typeStats.completed} done, ${typeStats.failed} failed`);
    }
  }

  console.log('');
}
