import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  ASSISTANT_NAME,
  DATA_DIR,
  IDLE_TIMEOUT,
  MAIN_GROUP_FOLDER,
  POLL_INTERVAL,
  TELEGRAM_BOT_POOL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_ONLY,
  TRIGGER_PATTERN,
} from './config.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import {
  ContainerOutput,
  runContainerAgent,
  writeGroupsSnapshot,
  writeTasksSnapshot,
} from './container-runner.js';
import {
  getAllChats,
  getAllRegisteredGroups,
  getAllSessions,
  getAllTasks,
  getMessagesSince,
  getNewMessages,
  getRouterState,
  initDatabase,
  setRegisteredGroup,
  setRouterState,
  setSession,
  storeChatMetadata,
  storeMessage,
} from './db.js';
import { GroupQueue } from './group-queue.js';
import { startIpcWatcher } from './ipc.js';
import { formatMessages, formatOutbound } from './router.js';
import { startSchedulerLoop } from './task-scheduler.js';
import {
  connectTelegram,
  initBotPool,
  sendPoolMessage,
  sendTelegramMessage,
  setTelegramTyping,
  stopTelegram,
} from './telegram.js';
import { NewMessage, RegisteredGroup } from './types.js';
import { logger } from './logger.js';

// Re-export for backwards compatibility during refactor
export { escapeXml, formatMessages } from './router.js';

let lastTimestamp = '';
let lastId = '';
let sessions: Record<string, string> = {};
let registeredGroups: Record<string, RegisteredGroup[]> = {};
let lastAgentTimestamp: Record<string, string> = {};
let lastAgentId: Record<string, string> = {};
let messageLoopRunning = false;

let whatsapp: WhatsAppChannel;
const queue = new GroupQueue();

function loadState(): void {
  lastTimestamp = getRouterState('last_timestamp') || '';
  lastId = getRouterState('last_id') || '';
  const agentTs = getRouterState('last_agent_timestamp');
  try {
    lastAgentTimestamp = agentTs ? JSON.parse(agentTs) : {};
  } catch {
    logger.warn('Corrupted last_agent_timestamp in DB, resetting');
    lastAgentTimestamp = {};
  }
  const agentId = getRouterState('last_agent_id');
  try {
    lastAgentId = agentId ? JSON.parse(agentId) : {};
  } catch {
    logger.warn('Corrupted last_agent_id in DB, resetting');
    lastAgentId = {};
  }
  sessions = getAllSessions();
  registeredGroups = getAllRegisteredGroups();
  logger.info(
    { groupCount: Object.keys(registeredGroups).length },
    'State loaded',
  );
}

function saveState(): void {
  setRouterState('last_timestamp', lastTimestamp);
  setRouterState('last_id', lastId);
  setRouterState(
    'last_agent_timestamp',
    JSON.stringify(lastAgentTimestamp),
  );
  setRouterState(
    'last_agent_id',
    JSON.stringify(lastAgentId),
  );
}

function registerGroup(jid: string, group: RegisteredGroup): void {
  if (!registeredGroups[jid]) {
    registeredGroups[jid] = [];
  }
  registeredGroups[jid].push(group);
  setRegisteredGroup(jid, group);

  // Create group folder
  const groupDir = path.join(DATA_DIR, '..', 'groups', group.folder);
  fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

  logger.info(
    { jid, name: group.name, folder: group.folder },
    'Group registered',
  );
}

/**
 * Get available groups list for the agent.
 * Returns groups ordered by most recent activity.
 */
export function getAvailableGroups(): import('./container-runner.js').AvailableGroup[] {
  const chats = getAllChats();
  const registeredJids = new Set(Object.keys(registeredGroups));

  return chats
    .filter((c) => c.jid !== '__group_sync__' && (c.jid.endsWith('@g.us') || c.jid.startsWith('tg:')))
    .map((c) => ({
      jid: c.jid,
      name: c.name,
      lastActivity: c.last_message_time,
      isRegistered: registeredJids.has(c.jid),
    }));
}

/** @internal - exported for testing */
export function _setRegisteredGroups(groups: Record<string, RegisteredGroup[]>): void {
  registeredGroups = groups;
}

/**
 * Process all pending messages for a group.
 * Called by the GroupQueue when it's this group's turn.
 */
async function processGroupMessages(chatJid: string): Promise<boolean> {
  const groups = registeredGroups[chatJid];
  if (!groups || groups.length === 0) return true;

  const sinceTimestamp = lastAgentTimestamp[chatJid] || '';
  const sinceId = lastAgentId[chatJid] || '';
  const missedMessages = getMessagesSince(chatJid, sinceTimestamp, sinceId, ASSISTANT_NAME);

  if (missedMessages.length === 0) return true;

  // Process each group registered to this channel
  for (const group of groups) {
    const isMainGroup = group.folder === MAIN_GROUP_FOLDER;

    // For non-main groups, check if trigger is required and present
    if (!isMainGroup && group.requiresTrigger !== false) {
      const triggerPattern = new RegExp(`^${group.trigger}\\b`, 'i');
      const hasTrigger = missedMessages.some((m) =>
        triggerPattern.test(m.content.trim()),
      );
      if (!hasTrigger) continue;
    }

    const success = await processGroupMessagesForSingleGroup(chatJid, group, missedMessages);
    if (!success) return false;
  }

  // Only advance cursor if all groups processed successfully
  lastAgentTimestamp[chatJid] = missedMessages[missedMessages.length - 1].timestamp;
  lastAgentId[chatJid] = missedMessages[missedMessages.length - 1].id;
  saveState();

  return true;
}

async function processGroupMessagesForSingleGroup(
  chatJid: string,
  group: RegisteredGroup,
  missedMessages: NewMessage[],
): Promise<boolean> {

  const prompt = formatMessages(missedMessages);

  logger.info(
    { group: group.name, messageCount: missedMessages.length },
    'Processing messages',
  );

  // Track idle timer for closing stdin when agent is idle
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      logger.debug({ group: group.name }, 'Idle timeout, closing container stdin');
      queue.closeStdin(chatJid);
    }, IDLE_TIMEOUT);
  };

  await setTyping(chatJid, true);
  let hadError = false;
  let outputSentToUser = false;

  const output = await runAgent(group, prompt, chatJid, async (result) => {
    // Streaming output callback — called for each agent result
    if (result.result) {
      const raw = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
      // Strip <internal>...</internal> blocks — agent uses these for internal reasoning
      const text = raw.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
      logger.info({ group: group.name }, `Agent output: ${raw.slice(0, 200)}`);
      if (text) {
        // Telegram bots already show their name — skip prefix for tg: chats
        const prefix = chatJid.startsWith('tg:') ? '' : `${ASSISTANT_NAME}: `;
        await sendMessage(chatJid, `${prefix}${text}`);
        outputSentToUser = true;
      }
      // Only reset idle timer on actual results, not session-update markers (result: null)
      resetIdleTimer();
    }

    if (result.status === 'error') {
      hadError = true;
    }
  });

  await setTyping(chatJid, false);
  if (idleTimer) clearTimeout(idleTimer);

  if (output === 'error' || hadError) {
    // If we already sent output to the user, don't fail the whole batch —
    // the user got their response and re-processing would send duplicates.
    if (outputSentToUser) {
      logger.warn({ group: group.name }, 'Agent error after output was sent');
      return true;
    }
    logger.warn({ group: group.name }, 'Agent error');
    return false;
  }

  return true;
}

async function runAgent(
  group: RegisteredGroup,
  prompt: string,
  chatJid: string,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<'success' | 'error'> {
  const isMain = group.folder === MAIN_GROUP_FOLDER;
  const sessionId = sessions[group.folder];

  // Update tasks snapshot for container to read (filtered by group)
  const tasks = getAllTasks();
  writeTasksSnapshot(
    group.folder,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  // Update available groups snapshot (main group only can see all groups)
  const availableGroups = getAvailableGroups();
  writeGroupsSnapshot(
    group.folder,
    isMain,
    availableGroups,
    new Set(Object.keys(registeredGroups)),
  );

  // Wrap onOutput to track session ID from streamed results
  const wrappedOnOutput = onOutput
    ? async (output: ContainerOutput) => {
        if (output.newSessionId) {
          sessions[group.folder] = output.newSessionId;
          setSession(group.folder, output.newSessionId);
        }
        await onOutput(output);
      }
    : undefined;

  try {
    const output = await runContainerAgent(
      group,
      {
        prompt,
        sessionId,
        groupFolder: group.folder,
        chatJid,
        isMain,
      },
      (proc, containerName) => queue.registerProcess(chatJid, proc, containerName, group.folder),
      wrappedOnOutput,
    );

    if (output.newSessionId) {
      sessions[group.folder] = output.newSessionId;
      setSession(group.folder, output.newSessionId);
    }

    if (output.status === 'error') {
      logger.error(
        { group: group.name, error: output.error },
        'Container agent error',
      );
      return 'error';
    }

    return 'success';
  } catch (err) {
    logger.error({ group: group.name, err }, 'Agent error');
    return 'error';
  }
}


async function sendMessage(jid: string, text: string): Promise<void> {
  // Route Telegram messages directly (WhatsAppChannel handles WA reconnection)
  if (jid.startsWith('tg:')) {
    await sendTelegramMessage(jid, text);
    return;
  }
  if (whatsapp) await whatsapp.sendMessage(jid, text);
}

async function setTyping(jid: string, isTyping: boolean): Promise<void> {
  if (jid.startsWith('tg:')) {
    if (isTyping) await setTelegramTyping(jid);
    return;
  }
  if (whatsapp) await whatsapp.setTyping(jid, isTyping);
}

async function startMessageLoop(): Promise<void> {
  if (messageLoopRunning) {
    logger.debug('Message loop already running, skipping duplicate start');
    return;
  }
  messageLoopRunning = true;

  logger.info(`NanoClaw running (trigger: @${ASSISTANT_NAME})`);

  while (true) {
    try {
      const jids = Object.keys(registeredGroups);
      const { messages, newTimestamp, newId } = getNewMessages(jids, lastTimestamp, lastId, ASSISTANT_NAME);

      if (messages.length > 0) {
        logger.info({ count: messages.length }, 'New messages');

        // Advance the "seen" cursor for all messages immediately
        lastTimestamp = newTimestamp;
        lastId = newId;
        saveState();

        // Deduplicate by group
        const messagesByGroup = new Map<string, NewMessage[]>();
        for (const msg of messages) {
          const existing = messagesByGroup.get(msg.chat_jid);
          if (existing) {
            existing.push(msg);
          } else {
            messagesByGroup.set(msg.chat_jid, [msg]);
          }
        }

        for (const [chatJid, groupMessages] of messagesByGroup) {
          const groups = registeredGroups[chatJid];
          if (!groups || groups.length === 0) continue;

          // Check each group to see if its trigger is present
          for (const group of groups) {
            const isMainGroup = group.folder === MAIN_GROUP_FOLDER;
            const needsTrigger = !isMainGroup && group.requiresTrigger !== false;

            // For non-main groups, only act on trigger messages.
            // Non-trigger messages accumulate in DB and get pulled as
            // context when a trigger eventually arrives.
            if (needsTrigger) {
              const triggerPattern = new RegExp(`^${group.trigger}\\b`, 'i');
              const hasTrigger = groupMessages.some((m) =>
                triggerPattern.test(m.content.trim()),
              );
              if (!hasTrigger) continue;
            }

          // Pull all messages since lastAgentTimestamp so non-trigger
          // context that accumulated between triggers is included.
          const allPending = getMessagesSince(
            chatJid,
            lastAgentTimestamp[chatJid] || '',
            lastAgentId[chatJid] || '',
            ASSISTANT_NAME,
          );
          const messagesToSend =
            allPending.length > 0 ? allPending : groupMessages;
          const formatted = formatMessages(messagesToSend);

          if (queue.sendMessage(chatJid, formatted)) {
            logger.debug(
              { chatJid, count: messagesToSend.length },
              'Piped messages to active container',
            );
            lastAgentTimestamp[chatJid] =
              messagesToSend[messagesToSend.length - 1].timestamp;
            lastAgentId[chatJid] =
              messagesToSend[messagesToSend.length - 1].id;
            saveState();
            // Show typing indicator while the container processes the piped message
            setTyping(chatJid, true);
          } else {
            // No active container — enqueue for a new one
            queue.enqueueMessageCheck(chatJid);
          }
          // For multi-group support: only pipe to first matching group
          break;
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in message loop');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Startup recovery: check for unprocessed messages in registered groups.
 * Handles crash between advancing lastTimestamp and processing messages.
 */
function recoverPendingMessages(): void {
  for (const [chatJid, groups] of Object.entries(registeredGroups)) {
    if (!groups || groups.length === 0) continue;
    const sinceTimestamp = lastAgentTimestamp[chatJid] || '';
    const sinceId = lastAgentId[chatJid] || '';
    const pending = getMessagesSince(chatJid, sinceTimestamp, sinceId, ASSISTANT_NAME);
    if (pending.length > 0) {
      logger.info(
        { chatJid, groupCount: groups.length, pendingCount: pending.length },
        'Recovery: found unprocessed messages',
      );
      queue.enqueueMessageCheck(chatJid);
    }
  }
}

function ensureContainerSystemRunning(): void {
  try {
    execSync('container system status', { stdio: 'pipe' });
    logger.debug('Apple Container system already running');
  } catch {
    logger.info('Starting Apple Container system...');
    try {
      execSync('container system start', { stdio: 'pipe', timeout: 30000 });
      logger.info('Apple Container system started');
    } catch (err) {
      logger.error({ err }, 'Failed to start Apple Container system');
      console.error(
        '\n╔════════════════════════════════════════════════════════════════╗',
      );
      console.error(
        '║  FATAL: Apple Container system failed to start                 ║',
      );
      console.error(
        '║                                                                ║',
      );
      console.error(
        '║  Agents cannot run without Apple Container. To fix:           ║',
      );
      console.error(
        '║  1. Install from: https://github.com/apple/container/releases ║',
      );
      console.error(
        '║  2. Run: container system start                               ║',
      );
      console.error(
        '║  3. Restart NanoClaw                                          ║',
      );
      console.error(
        '╚════════════════════════════════════════════════════════════════╝\n',
      );
      throw new Error('Apple Container system is required but failed to start');
    }
  }

  // Kill and clean up orphaned NanoClaw containers from previous runs
  try {
    const output = execSync('container ls --format json', {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    const containers: { status: string; configuration: { id: string } }[] = JSON.parse(output || '[]');
    const orphans = containers
      .filter((c) => c.status === 'running' && c.configuration.id.startsWith('nanoclaw-'))
      .map((c) => c.configuration.id);
    for (const name of orphans) {
      try {
        execSync(`container stop ${name}`, { stdio: 'pipe' });
      } catch { /* already stopped */ }
    }
    if (orphans.length > 0) {
      logger.info({ count: orphans.length, names: orphans }, 'Stopped orphaned containers');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to clean up orphaned containers');
  }
}

async function main(): Promise<void> {
  ensureContainerSystemRunning();
  initDatabase();
  logger.info('Database initialized');
  loadState();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    stopTelegram();
    await queue.shutdown(10000);
    if (whatsapp) await whatsapp.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start Telegram bot if configured (independent of WhatsApp)
  if (TELEGRAM_BOT_TOKEN) {
    await connectTelegram(TELEGRAM_BOT_TOKEN);
  }
  if (TELEGRAM_BOT_POOL.length > 0) {
    await initBotPool(TELEGRAM_BOT_POOL);
  }

  if (!TELEGRAM_ONLY) {
    // Create WhatsApp channel
    whatsapp = new WhatsAppChannel({
      onMessage: (chatJid, msg) => storeMessage(msg),
      onChatMetadata: (chatJid, timestamp) => storeChatMetadata(chatJid, timestamp),
      registeredGroups: () => registeredGroups,
    });

    // Connect — resolves when first connected
    await whatsapp.connect();
  }

  // Start subsystems
  startSchedulerLoop({
    registeredGroups: () => registeredGroups,
    getSessions: () => sessions,
    queue,
    onProcess: (groupJid, proc, containerName, groupFolder) => queue.registerProcess(groupJid, proc, containerName, groupFolder),
    sendMessage: async (jid, rawText) => {
      const text = formatOutbound(rawText);
      if (text) await sendMessage(jid, text);
    },
  });
  startIpcWatcher({
    sendMessage: (jid, text) => sendMessage(jid, text),
    sendPoolMessage: sendPoolMessage,
    registeredGroups: () => registeredGroups,
    registerGroup,
    syncGroupMetadata: (force) => whatsapp ? whatsapp.syncGroupMetadata(force) : Promise.resolve(),
    getAvailableGroups,
    writeGroupsSnapshot: (gf, im, ag, rj) => writeGroupsSnapshot(gf, im, ag, rj),
  });
  queue.setProcessMessagesFn(processGroupMessages);
  recoverPendingMessages();
  startMessageLoop();

  if (TELEGRAM_ONLY) {
    logger.info(`NanoClaw running (Telegram-only, trigger: @${ASSISTANT_NAME})`);
  }
}

// Guard: only run when executed directly, not when imported by tests
const isDirectRun =
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  main().catch((err) => {
    logger.error({ err }, 'Failed to start NanoClaw');
    process.exit(1);
  });
}
