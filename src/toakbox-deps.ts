/**
 * ToakBoxDeps — Real implementation of the ToakBox dependency injection interface.
 *
 * Connects the ToakBox policy engine to:
 *   - Toak HTTP API (via Hub) for messaging
 *   - nanoclaw SQLite (via db.ts) for task scheduling/cancellation
 */

import { randomUUID } from 'crypto';

import { CronExpressionParser } from 'cron-parser';

import { MAIN_GROUP_FOLDER } from './config.js';
import { createTask, deleteTask } from './db.js';
import { logger } from './logger.js';
import type { ScheduleRequest } from './toakbox.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ToakBoxDepsConfig {
  /** Override TOAK_API_URL env var. Default: https://hub.treebird.uk/api/toaklink */
  toakApiUrl?: string;
  /** Override TOAK_AGENT_ID env var. */
  agentId?: string;
  /** Override TOAK_API_KEY env var. */
  apiKey?: string;
  /** Agent to send approval requests to. Default: 'bsan' */
  approvalAgentId?: string;
  /** nanoclaw group_folder for created tasks. Default: MAIN_GROUP_FOLDER */
  groupFolder?: string;
  /** Discord/chat JID for task output. Default: TOAKBOX_CHAT_JID env or 'toakbox@toaklink' */
  chatJid?: string;
}

export interface ToakBoxDeps {
  checkInbox: () => Promise<Array<{ from: string; message: string; id: string }>>;
  sendToAgent: (to: string, message: string) => Promise<void>;
  requestApproval: (action: string, context: string, timeoutMinutes: number) => Promise<boolean>;
  scheduleTask: (request: ScheduleRequest) => Promise<string>;
  cancelTask: (taskId: string) => Promise<void>;
  wakeAgent: (agentId: string, message?: string) => Promise<void>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth helpers — mirrors toak/src/auth.ts buildAuthHeaders format
// ──────────────────────────────────────────────────────────────────────────────

function makeHeaders(agentId: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Agent-Id': agentId,
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

// ──────────────────────────────────────────────────────────────────────────────
// Schedule helpers
// ──────────────────────────────────────────────────────────────────────────────

function nextRunFromAt(at: string): string {
  const [h, m] = at.split(':').map(Number);
  const next = new Date();
  next.setUTCHours(h, m, 0, 0);
  if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────────────────────

export function createToakBoxDeps(config: ToakBoxDepsConfig = {}): ToakBoxDeps {
  const toakApiUrl =
    config.toakApiUrl ?? process.env.TOAK_API_URL ?? 'https://hub.treebird.uk/api/toaklink';
  const agentId = config.agentId ?? process.env.TOAK_AGENT_ID ?? '';
  const apiKey = config.apiKey ?? process.env.TOAK_API_KEY ?? '';
  const approvalAgentId = config.approvalAgentId ?? 'bsan';
  const groupFolder = config.groupFolder ?? MAIN_GROUP_FOLDER;
  const chatJid = config.chatJid ?? process.env.TOAKBOX_CHAT_JID ?? 'toakbox@toaklink';

  const h = () => makeHeaders(agentId, apiKey);

  // ── checkInbox ──────────────────────────────────────────────────────────────

  async function checkInbox(): Promise<Array<{ from: string; message: string; id: string }>> {
    const url = `${toakApiUrl}/inbox/${agentId}`;
    const res = await fetch(url, { headers: h() });
    if (!res.ok) {
      throw new Error(`checkInbox: ${res.status} ${await res.text()}`);
    }

    // Hub may return either a "conversations" shape or a "channels" shape
    const data = (await res.json()) as {
      conversations?: Array<{
        from: string;
        messages: Array<{ id: string; content: string }>;
      }>;
      channels?: Array<{
        id: string;
        unread: number;
        messages?: Array<{ id: string; from: string; message?: string; content?: string }>;
      }>;
    };

    const result: Array<{ from: string; message: string; id: string }> = [];
    const readIds: string[] = [];

    if (data.conversations) {
      for (const convo of data.conversations) {
        for (const msg of convo.messages) {
          result.push({ from: convo.from, message: msg.content, id: msg.id });
          readIds.push(msg.id);
        }
      }
    } else if (data.channels) {
      for (const channel of data.channels) {
        if (!channel.unread) continue;
        const chanUrl = `${toakApiUrl}/channel/${channel.id}`;
        const chanRes = await fetch(chanUrl, { headers: h() });
        if (!chanRes.ok) continue;
        const chanData = (await chanRes.json()) as {
          messages?: Array<{ id: string; from: string; message?: string; content?: string }>;
        };
        for (const msg of chanData.messages ?? []) {
          result.push({
            from: msg.from,
            message: msg.message ?? msg.content ?? '',
            id: msg.id,
          });
          readIds.push(msg.id);
        }
      }
    }

    // Mark read — fire-and-forget
    if (readIds.length > 0) {
      const markUrl = `${toakApiUrl}/mark-read/${agentId}`;
      const markBody = JSON.stringify({ messageIds: readIds });
      fetch(markUrl, { method: 'POST', headers: h(), body: markBody }).catch((err) =>
        logger.warn({ err }, 'ToakBoxDeps: mark-read failed'),
      );
    }

    return result;
  }

  // ── sendToAgent ─────────────────────────────────────────────────────────────

  function sendToAgent(to: string, message: string): Promise<void> {
    const url = `${toakApiUrl}/send`;
    const body = JSON.stringify({ from: agentId, to, message });
    // Fire-and-forget — ToakBox must keep running even if a send fails
    fetch(url, { method: 'POST', headers: h(), body }).catch((err) =>
      logger.warn({ err, to }, 'ToakBoxDeps.sendToAgent failed'),
    );
    return Promise.resolve();
  }

  // ── scheduleTask ────────────────────────────────────────────────────────────

  async function scheduleTask(request: ScheduleRequest): Promise<string> {
    const taskId = `toakbox-${request.from}-${Date.now()}`;
    const now = new Date();
    let scheduleType: 'once' | 'cron';
    let scheduleValue: string;
    let nextRun: string | null = null;

    if (request.action === 'run_at') {
      scheduleType = 'once';
      scheduleValue = request.at ?? '';
      nextRun = nextRunFromAt(request.at ?? '00:00');
    } else if (request.action === 'run_in') {
      scheduleType = 'once';
      const ms = request.in ?? 0;
      nextRun = new Date(Date.now() + ms).toISOString();
      scheduleValue = nextRun;
    } else if (request.action === 'run_cron') {
      scheduleType = 'cron';
      scheduleValue = request.cron ?? '';
      try {
        const interval = CronExpressionParser.parse(scheduleValue, {
          tz: request.timezone ?? 'UTC',
          currentDate: now,
        });
        nextRun = interval.next().toISOString();
      } catch {
        nextRun = null;
      }
    } else {
      throw new Error(`scheduleTask: unsupported action '${request.action}'`);
    }

    createTask({
      id: taskId,
      group_folder: groupFolder,
      chat_jid: chatJid,
      prompt: request.command ?? request.action,
      schedule_type: scheduleType,
      schedule_value: scheduleValue,
      context_mode: 'isolated',
      next_run: nextRun,
      status: 'active',
      created_at: now.toISOString(),
    });

    return taskId;
  }

  // ── cancelTask ──────────────────────────────────────────────────────────────

  async function cancelTask(taskId: string): Promise<void> {
    deleteTask(taskId);
  }

  // ── wakeAgent ───────────────────────────────────────────────────────────────

  async function wakeAgent(agentIdParam: string, message?: string): Promise<void> {
    return sendToAgent(agentIdParam, message ?? 'WAKE: You have been woken by ToakBox');
  }

  // ── requestApproval ─────────────────────────────────────────────────────────

  function requestApproval(
    action: string,
    context: string,
    timeoutMinutes: number,
  ): Promise<boolean> {
    const approvalId = randomUUID();
    sendToAgent(
      approvalAgentId,
      JSON.stringify({ type: 'approval_request', approvalId, action, context, replyTo: agentId }),
    );

    return new Promise<boolean>((resolve) => {
      const deadline = Date.now() + timeoutMinutes * 60_000;

      const poll = () => {
        if (Date.now() >= deadline) {
          logger.warn({ action, timeoutMinutes }, 'ToakBoxDeps.requestApproval: timed out');
          resolve(false);
          return;
        }

        checkInbox()
          .then((messages) => {
            for (const msg of messages) {
              if (msg.from === approvalAgentId) {
                if (/APPROVED/i.test(msg.message)) {
                  resolve(true);
                  return;
                }
                if (/REJECTED/i.test(msg.message)) {
                  resolve(false);
                  return;
                }
              }
            }
            setTimeout(poll, 30_000);
          })
          .catch(() => setTimeout(poll, 30_000));
      };

      setTimeout(poll, 30_000);
    });
  }

  return { checkInbox, sendToAgent, requestApproval, scheduleTask, cancelTask, wakeAgent };
}
