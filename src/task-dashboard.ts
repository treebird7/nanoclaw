/**
 * Task Visibility Dashboard
 * Provides unified view of scheduled tasks across all groups
 */
import { logger } from './logger.js';
import { getAllTasks } from './db.js';

interface TaskSummary {
  total: number;
  active: number;
  paused: number;
  completed: number;
  stuck: number;
  byGroup: Record<string, number>;
  stuckTasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    nextRun: string;
    status: string;
  }>;
  recentFailures: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    error?: string;
  }>;
}

/**
 * Generate task summary statistics
 */
export function generateTaskSummary(): TaskSummary {
  const tasks = getAllTasks();
  const now = new Date().toISOString();

  const summary: TaskSummary = {
    total: tasks.length,
    active: 0,
    paused: 0,
    completed: 0,
    stuck: 0,
    byGroup: {},
    stuckTasks: [],
    recentFailures: [],
  };

  for (const task of tasks) {
    // Count by status
    if (task.status === 'active') summary.active++;
    else if (task.status === 'paused') summary.paused++;
    else if (task.status === 'completed') summary.completed++;

    // Count by group
    summary.byGroup[task.group_folder] = (summary.byGroup[task.group_folder] || 0) + 1;

    // Identify stuck tasks (should have run but didn't)
    if (task.status === 'active' && task.next_run && task.next_run < now) {
      summary.stuck++;
      summary.stuckTasks.push({
        id: task.id,
        groupFolder: task.group_folder,
        prompt: task.prompt.slice(0, 100) + (task.prompt.length > 100 ? '...' : ''),
        nextRun: task.next_run,
        status: task.status,
      });
    }
  }

  return summary;
}

/**
 * Format task summary as Discord message
 */
export function formatTaskDashboard(summary: TaskSummary): string {
  let message = '📊 **Task Dashboard**\n\n';

  // Overall stats
  message += `**Status Overview**:\n`;
  message += `• Total Tasks: ${summary.total}\n`;
  message += `• 🟢 Active: ${summary.active}\n`;
  message += `• ⏸️ Paused: ${summary.paused}\n`;
  message += `• ✅ Completed: ${summary.completed}\n`;

  if (summary.stuck > 0) {
    message += `• ⚠️ **Stuck**: ${summary.stuck}\n`;
  }

  message += '\n';

  // Group breakdown
  if (Object.keys(summary.byGroup).length > 0) {
    message += `**Tasks by Group**:\n`;
    for (const [group, count] of Object.entries(summary.byGroup).sort((a, b) => b[1] - a[1])) {
      message += `• ${group}: ${count}\n`;
    }
    message += '\n';
  }

  // Stuck tasks (needs attention)
  if (summary.stuckTasks.length > 0) {
    message += `**⚠️ Needs Attention** (${summary.stuckTasks.length} stuck tasks):\n`;
    for (const task of summary.stuckTasks.slice(0, 5)) {
      const minutesLate = Math.floor((Date.now() - new Date(task.nextRun).getTime()) / 60000);
      message += `• [${task.groupFolder}] ${task.prompt.slice(0, 60)}...\n`;
      message += `  _Should have run ${minutesLate} minutes ago_\n`;
    }

    if (summary.stuckTasks.length > 5) {
      message += `  _...and ${summary.stuckTasks.length - 5} more_\n`;
    }
    message += '\n';
  }

  // All clear message
  if (summary.stuck === 0 && summary.active > 0) {
    message += '✅ All scheduled tasks are running on time!\n\n';
  }

  if (summary.active === 0 && summary.total === 0) {
    message += '_No scheduled tasks configured yet._\n\n';
  }

  message += `_Last updated: ${new Date().toLocaleTimeString()}_`;

  return message;
}

/**
 * Generate task dashboard message
 */
export function generateTaskDashboard(): string {
  logger.info('Generating task visibility dashboard');

  const summary = generateTaskSummary();

  logger.info({
    total: summary.total,
    active: summary.active,
    stuck: summary.stuck,
  }, 'Task summary generated');

  return formatTaskDashboard(summary);
}

/**
 * Check if dashboard should be posted (suppress if no changes)
 */
export function shouldPostDashboard(lastSummary: TaskSummary | null, currentSummary: TaskSummary): boolean {
  if (!lastSummary) return true; // First run

  // Post if status counts changed
  if (
    lastSummary.active !== currentSummary.active ||
    lastSummary.paused !== currentSummary.paused ||
    lastSummary.stuck !== currentSummary.stuck
  ) {
    return true;
  }

  // Post if stuck tasks changed
  if (lastSummary.stuckTasks.length !== currentSummary.stuckTasks.length) {
    return true;
  }

  // Otherwise suppress (no changes)
  return false;
}
