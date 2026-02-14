#!/usr/bin/env node
/**
 * Setup script for Task Dashboard scheduled task
 * Run this once to schedule the hourly task dashboard
 */
import { initDatabase, createTask, getAllRegisteredGroups } from './db.js';
import { CronExpressionParser } from 'cron-parser';
import { TIMEZONE, MAIN_GROUP_FOLDER } from './config.js';

async function setupTaskDashboard() {
  // Initialize database first
  initDatabase();

  // Get main group JID
  const groups = getAllRegisteredGroups();
  const mainGroup = Object.entries(groups).find(([, group]) => group.folder === MAIN_GROUP_FOLDER);

  if (!mainGroup) {
    console.error('Main group not found in registered groups');
    process.exit(1);
  }

  const [mainGroupJid] = mainGroup;

  // Schedule for every hour at :00
  const cronExpression = '0 * * * *';

  // Calculate next run time
  const interval = CronExpressionParser.parse(cronExpression, {
    tz: TIMEZONE,
    currentDate: new Date(),
  });
  const nextRun = interval.next().toISOString();

  const taskId = `task-dashboard-${Date.now()}`;

  // Create the task
  createTask({
    id: taskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: mainGroupJid,
    prompt: `Generate the hourly task visibility dashboard.

Check all scheduled tasks across all groups and provide a status summary:
- Total tasks by status (active, paused, completed)
- Tasks grouped by group folder
- Stuck tasks (next_run in past but still active)
- Recent failures

Use the task-dashboard generator to create a formatted report.

Post to the main Discord channel ONLY if there are changes since last report:
- Status counts changed
- Stuck tasks changed
- New tasks added or removed

If no changes, skip posting (silent suppression).`,
    schedule_type: 'cron',
    schedule_value: cronExpression,
    context_mode: 'group',
    next_run: nextRun,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  console.log('✅ Task dashboard scheduled successfully!');
  console.log(`Task ID: ${taskId}`);
  console.log(`Schedule: Every hour at :00 (${TIMEZONE})`);
  console.log(`Next run: ${nextRun}`);
  console.log('Dashboard will post to main channel when changes detected.');
}

setupTaskDashboard().catch((err) => {
  console.error('Failed to setup task dashboard:', err);
  process.exit(1);
});
