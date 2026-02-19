#!/usr/bin/env node
/**
 * Setup script for the Sansan ToakBox Daemon
 *
 * Registers a scheduled task that runs every 60 seconds,
 * checks the ToakLink inbox for schedule requests, and
 * processes them via whitelist/blacklist/escalate policy.
 *
 * Run once to activate: npx tsx src/setup-toakbox.ts
 */

import { initDatabase, createTask, getAllRegisteredGroups } from './db.js';
import { CronExpressionParser } from 'cron-parser';
import { TIMEZONE, MAIN_GROUP_FOLDER } from './config.js';
import { createToakBoxDeps } from './toakbox-deps.js';
import { ToakBox, loadPermissions, ToakBoxConfig } from './toakbox.js';

const TOAKBOX_PROMPT = `You are running the Sansan ToakBox Daemon — a policy-governed scheduler for the flock.

## Your Job

Check your ToakLink inbox for new schedule requests from agents. For each new message:
1. Parse it as a schedule request
2. Check the permission policy (whitelist/blacklist)
3. Execute, reject, or escalate to Treebird for approval
4. Reply to the requesting agent with the outcome
5. Log all actions to the daily collab

## Schedule Request Format

Agents send JSON via ToakLink to "sansan":
\`\`\`json
{
  "type": "schedule_request",
  "from": "codex",
  "action": "run_at",
  "command": "npm run build",
  "at": "02:00",
  "timezone": "UTC",
  "reason": "nightly build verification"
}
\`\`\`

Valid actions: run_at, run_in, run_cron, wake_agent, cancel

## Permission Policy

**AUTO-APPROVE** (no human needed):
- Agents: sasusan, treesan, sherlocksan, codex, birdsan, mappersan, watsan, yosef
- Commands: npm test, git pull, git fetch, git status, npx tsx src/*.ts
- Action: wake_agent (always safe — just sends a ToakLink message)

**AUTO-REJECT** (never allowed):
- Commands containing: rm -rf, git push --force, DROP TABLE, curl | bash, wget | sh
- Requests from unregistered/unknown agents

**ESCALATE TO TREEBIRD** (unknown):
- Anything not matching whitelist or blacklist
- Use request_approval tool with: who is asking, what they want, why, risk level
- If no response in 30 minutes: auto-reject and notify requesting agent

## Processing Each Request

1. Check toaklink_inbox for unread messages
2. For messages with type="schedule_request":
   a. Parse the JSON
   b. Apply policy rules above
   c. If APPROVED: schedule via mcp__nanoclaw__schedule_task, reply "✅ Scheduled! Will run at [time]."
   d. If REJECTED: reply "❌ Rejected — [specific reason]."
   e. If ESCALATED: request_approval from Treebird, then notify agent of outcome
3. Log each action: toaklink_collab("ToakBox: [from] → [action] → [decision]")

## If No New Messages

Do nothing. Do not post to Discord. Silent suppression.

## Notes

- You are sansan (agent ID: snco). Only process messages addressed to you.
- Non-schedule messages: acknowledge politely but explain this daemon only handles scheduling.
- Keep replies brief and clear — agents need actionable responses.
- Log everything to collab for audit trail.`;

async function setupToakBox() {
  initDatabase();

  const groups = getAllRegisteredGroups();
  const mainGroup = Object.entries(groups).find(([, g]) => g.folder === MAIN_GROUP_FOLDER);

  if (!mainGroup) {
    console.error('❌ Main group not found in registered groups');
    process.exit(1);
  }

  const [mainGroupJid] = mainGroup;

  // Run every 2 minutes — frequent enough to be responsive,
  // not so frequent it hammers the ToakLink API
  const cronExpression = '*/2 * * * *';

  const interval = CronExpressionParser.parse(cronExpression, {
    tz: TIMEZONE,
    currentDate: new Date(),
  });
  const nextRun = interval.next().toISOString();

  const taskId = `toakbox-daemon-${Date.now()}`;

  createTask({
    id: taskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: mainGroupJid,
    prompt: TOAKBOX_PROMPT,
    schedule_type: 'cron',
    schedule_value: cronExpression,
    context_mode: 'isolated',
    next_run: nextRun,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  console.log('✅ ToakBox daemon scheduled!');
  console.log(`Task ID: ${taskId}`);
  console.log(`Schedule: Every 2 minutes`);
  console.log(`Next run: ${nextRun}`);
  console.log(`Timezone: ${TIMEZONE}`);
  console.log('');
  console.log('ToakBox will:');
  console.log('  - Check sansan ToakLink inbox every 2 minutes');
  console.log('  - Auto-approve whitelisted agents/commands');
  console.log('  - Auto-reject blacklisted commands');
  console.log('  - Escalate unknowns to Treebird for approval');
  console.log('  - Log all actions to daily collab');
}

setupToakBox().catch((err) => {
  console.error('Failed to setup ToakBox:', err);
  process.exit(1);
});

// ──────────────────────────────────────────────────────────────────────────────
// Programmatic daemon mode (used when --daemon flag is passed)
// Uses real ToakBoxDeps instead of AI-driven prompt scheduling.
// ──────────────────────────────────────────────────────────────────────────────

export function startToakBoxDaemon(
  daemonConfig: Partial<ToakBoxConfig> & { chatJid?: string } = {},
): ToakBox {
  initDatabase();

  const deps = createToakBoxDeps({
    groupFolder: MAIN_GROUP_FOLDER,
    chatJid: daemonConfig.chatJid ?? process.env.TOAKBOX_CHAT_JID,
  });

  const permissionFilePath =
    daemonConfig.permissionFilePath ??
    process.env.TOAKBOX_PERMISSION_FILE ??
    'config/toakbox-permissions.json';

  const config: ToakBoxConfig = {
    pollIntervalMs: daemonConfig.pollIntervalMs ?? 120_000,
    permissionFilePath,
    permissionRefreshMs: daemonConfig.permissionRefreshMs ?? 300_000,
    treebird_agent_id: daemonConfig.treebird_agent_id ?? 'bsan',
    collab_file: daemonConfig.collab_file,
  };

  const toakbox = new ToakBox(config, deps);
  toakbox.start();
  return toakbox;
}

if (process.argv.includes('--daemon')) {
  startToakBoxDaemon();
}
