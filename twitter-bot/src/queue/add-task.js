#!/usr/bin/env node
import { addTask, addTasks, printQueueStatus, retryFailedTasks, clearCompletedTasks } from './task-queue.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
📋 Twitter Bot Task Queue CLI

Usage:
  node src/queue/add-task.js <command> [options]

Commands:
  like <url>                    Add a like task
  comment <url> [text]          Add a comment task (uses template if no text)
  follow <url|@username>        Add a follow task
  unfollow <url|@username>      Add an unfollow task
  batch <file.json>             Add tasks from JSON file
  status                        Show queue status
  retry                         Retry failed tasks
  clear                         Clear completed tasks
  help                          Show this help

Examples:
  node src/queue/add-task.js like https://x.com/user/status/123456
  node src/queue/add-task.js comment https://x.com/user/status/123456 "great post!"
  node src/queue/add-task.js follow @username
  node src/queue/add-task.js follow https://x.com/username
  node src/queue/add-task.js batch my-tasks.json

Batch file format (my-tasks.json):
  [
    { "type": "like", "target": "https://x.com/..." },
    { "type": "follow", "target": "@username" },
    { "type": "comment", "target": "https://x.com/...", "params": { "text": "hello!" } }
  ]
`);
}

function normalizeTarget(target, type) {
  // For follow/unfollow, convert @username to URL
  if ((type === 'follow' || type === 'unfollow') && target.startsWith('@')) {
    return `https://x.com/${target.slice(1)}`;
  }
  return target;
}

async function main() {
  if (!command || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'like': {
      const url = args[1];
      if (!url) {
        console.error('Error: URL required');
        console.log('Usage: add-task.js like <url>');
        process.exit(1);
      }
      addTask('like', url);
      printQueueStatus();
      break;
    }

    case 'comment': {
      const url = args[1];
      const text = args.slice(2).join(' ');
      if (!url) {
        console.error('Error: URL required');
        console.log('Usage: add-task.js comment <url> [text]');
        process.exit(1);
      }
      const params = text ? { text } : {};
      addTask('comment', url, params);
      printQueueStatus();
      break;
    }

    case 'follow': {
      const target = args[1];
      if (!target) {
        console.error('Error: URL or @username required');
        console.log('Usage: add-task.js follow <url|@username>');
        process.exit(1);
      }
      addTask('follow', normalizeTarget(target, 'follow'));
      printQueueStatus();
      break;
    }

    case 'unfollow': {
      const target = args[1];
      if (!target) {
        console.error('Error: URL or @username required');
        console.log('Usage: add-task.js unfollow <url|@username>');
        process.exit(1);
      }
      addTask('unfollow', normalizeTarget(target, 'unfollow'));
      printQueueStatus();
      break;
    }

    case 'batch': {
      const file = args[1];
      if (!file) {
        console.error('Error: JSON file required');
        console.log('Usage: add-task.js batch <file.json>');
        process.exit(1);
      }

      try {
        const { readFileSync } = await import('fs');
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        const tasks = Array.isArray(data) ? data : data.tasks;

        if (!tasks || tasks.length === 0) {
          console.error('Error: No tasks found in file');
          process.exit(1);
        }

        // Normalize targets
        const normalizedTasks = tasks.map(t => ({
          ...t,
          target: normalizeTarget(t.target, t.type),
        }));

        addTasks(normalizedTasks);
        printQueueStatus();
      } catch (e) {
        console.error('Error reading file:', e.message);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      printQueueStatus();
      break;
    }

    case 'retry': {
      retryFailedTasks();
      printQueueStatus();
      break;
    }

    case 'clear': {
      clearCompletedTasks();
      printQueueStatus();
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
