#!/usr/bin/env node
/**
 * Setup script for Daily Digest scheduled task
 * Run this once to schedule the daily digest at 9 AM
 *
 * Usage:
 *   npx tsx src/setup-daily-digest-task.ts [target-channel-jid]
 *
 * If no channel JID provided, posts to main group.
 */
import { initDatabase, createTask, getAllRegisteredGroups } from './db.js';
import { CronExpressionParser } from 'cron-parser';
import { TIMEZONE, MAIN_GROUP_FOLDER } from './config.js';
import { logger } from './logger.js';

async function setupDailyDigestTask() {
  // Initialize database first
  initDatabase();

  // Get target channel from command line or use main group
  const targetChannelJid = process.argv[2];

  const groups = getAllRegisteredGroups();

  let targetJid: string;
  let targetName: string;

  if (targetChannelJid) {
    // Use specified channel
    targetJid = targetChannelJid;
    targetName = targetChannelJid; // Will be shown in logs
    console.log(`Target channel: ${targetChannelJid}`);
  } else {
    // Fall back to main group
    const mainGroup = Object.entries(groups).find(([, group]) => group.folder === MAIN_GROUP_FOLDER);

    if (!mainGroup) {
      console.error('Main group not found in registered groups');
      process.exit(1);
    }

    [targetJid] = mainGroup;
    targetName = 'main group';
    console.log(`No channel specified, using main group: ${targetJid}`);
  }

  // Schedule for 9 AM every day
  const cronExpression = '0 9 * * *';

  // Calculate next run time
  const interval = CronExpressionParser.parse(cronExpression, {
    tz: TIMEZONE,
    currentDate: new Date(),
  });
  const nextRun = interval.next().toISOString();

  const taskId = `daily-digest-${Date.now()}`;

  // Create the task
  createTask({
    id: taskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: targetJid,
    prompt: `Generate the daily digest from yesterday's TLDR entries and post to channel ${targetJid}.

Use the digest generator to scan all collab directories for TLDR sections:
- /workspace/extra/toak/collab/daily/
- /workspace/extra/watsan/logs/ (if available)
- /workspace/extra/sancast/ (if available)

Parse TLDR entries in this format:
\`17:00\` **Title** — description with #hashtags → [[optional-wikilink]]

Generate a formatted digest message and post it to the main Discord channel.

If no TLDR entries exist, post a brief "no activity" message.`,
    schedule_type: 'cron',
    schedule_value: cronExpression,
    context_mode: 'group',
    next_run: nextRun,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  console.log('✅ Daily digest task created successfully!');
  console.log(`Task ID: ${taskId}`);
  console.log(`Target: ${targetName} (${targetJid})`);
  console.log(`Schedule: Every day at 9 AM (${TIMEZONE})`);
  console.log(`Next run: ${nextRun}`);
  console.log(`The digest will automatically post to channel ${targetJid} each morning.`);
}

setupDailyDigestTask().catch((err) => {
  console.error('Failed to setup daily digest task:', err);
  process.exit(1);
});
