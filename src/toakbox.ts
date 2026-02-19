/**
 * ToakBox — Sansan's Policy-Governed Scheduling Daemon
 *
 * Listens for incoming ToakLink messages requesting scheduled tasks.
 * Checks a permission contract (whitelist/blacklist), then either:
 *   - Executes immediately (whitelisted)
 *   - Asks Treebird for approval (unknown)
 *   - Rejects (blacklisted)
 *
 * Message protocol (JSON via ToakLink to "sansan"):
 * {
 *   "type": "schedule_request",
 *   "from": "codex",
 *   "action": "run_at" | "run_in" | "run_cron" | "wake_agent" | "cancel",
 *   "command": "npm test",       // for run_at/run_in/run_cron
 *   "agent": "codex",            // for wake_agent
 *   "at": "02:00",               // for run_at (HH:MM UTC)
 *   "in": 3600000,               // for run_in (ms)
 *   "cron": "0 2 * * *",         // for run_cron
 *   "timezone": "UTC",
 *   "reason": "nightly build",
 *   "taskId": "abc-123"          // for cancel
 * }
 */

import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';
import type { AuditLogger } from './toakbox-audit.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ScheduleAction = 'run_at' | 'run_in' | 'run_cron' | 'wake_agent' | 'cancel';
export type DecisionResult = 'WHITELIST' | 'BLACKLIST' | 'UNKNOWN';

export interface ScheduleRequest {
  type: 'schedule_request';
  from: string;
  action: ScheduleAction;
  command?: string;
  agent?: string;
  at?: string;        // HH:MM UTC
  in?: number;        // ms
  cron?: string;
  timezone?: string;
  reason?: string;
  taskId?: string;    // for cancel
}

export interface PermissionContract {
  whitelist: {
    agents: string[];
    commands: string[];
    patterns: string[];
  };
  blacklist: {
    commands: string[];
    agents: string[];
    patterns: string[];
  };
  settings: {
    require_approval_for_unknown: boolean;
    approval_timeout_minutes: number;
    notify_on_execution: boolean;
    max_schedules_per_agent_per_day: number;
    max_active_schedules_per_agent?: number;
  };
}

export interface ToakBoxConfig {
  pollIntervalMs: number;
  permissionFilePath: string;    // local path to permissions YAML/JSON
  permissionRefreshMs: number;   // how often to reload permissions
  treebird_agent_id: string;     // who to ask for approval
  collab_file?: string;          // optional: path to daily collab file for audit logging
}

// ──────────────────────────────────────────────────────────────────────────────
// Default permission contract (safe defaults until file is loaded)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: PermissionContract = {
  whitelist: {
    agents: [
      'sasusan', 'treesan', 'sherlocksan', 'codex', 'birdsan',
      'mappersan', 'watsan', 'yosef', 'spidersan', 'artisan', 'marksan',
    ],
    commands: [
      'npm test', 'npm run build', 'npm run typecheck',
      'git pull', 'git fetch', 'git status', 'git log', 'wake_agent',
    ],
    patterns: [
      '^git (pull|fetch|status|log|diff)$',
      '^npm (test|run build|run typecheck|run lint)$',
      '^npx tsx src/.*\\.ts$',
      '^(toak|invoak|birdsan|spidersan) ',
    ],
  },
  blacklist: {
    commands: [
      'rm -rf',
      'git push --force',
      'DROP TABLE',
      'DROP DATABASE',
      'curl | bash',
      'wget | sh',
      'curl | sh',
      'wget | bash',
    ],
    agents: [],
    patterns: [
      'rm\\s+-rf',
      'sudo\\s',
      '--force',
      'DROP\\s+(TABLE|DATABASE)',
      '\\|\\s*(bash|sh)$',
      'eval\\s*\\(',
      'exec\\s*\\(',
    ],
  },
  settings: {
    require_approval_for_unknown: true,
    approval_timeout_minutes: 30,
    notify_on_execution: true,
    max_schedules_per_agent_per_day: 50,
    max_active_schedules_per_agent: 5,
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Permission evaluation
// ──────────────────────────────────────────────────────────────────────────────

function matchesPatterns(text: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p, 'i').test(text);
    } catch {
      return text.toLowerCase().includes(p.toLowerCase());
    }
  });
}

export function evaluate(
  request: ScheduleRequest,
  permissions: PermissionContract,
): DecisionResult {
  const command = request.command ?? '';
  const from = request.from ?? '';

  // Blacklist checks first (fast reject)
  if (permissions.blacklist.agents.includes(from)) {
    return 'BLACKLIST';
  }
  if (
    permissions.blacklist.commands.some((c) =>
      command.toLowerCase().includes(c.toLowerCase()),
    )
  ) {
    return 'BLACKLIST';
  }
  if (matchesPatterns(command, permissions.blacklist.patterns)) {
    return 'BLACKLIST';
  }

  // Whitelist checks
  if (permissions.whitelist.agents.includes(from)) {
    return 'WHITELIST';
  }
  if (
    permissions.whitelist.commands.some((c) =>
      command.toLowerCase() === c.toLowerCase(),
    )
  ) {
    return 'WHITELIST';
  }
  if (matchesPatterns(command, permissions.whitelist.patterns)) {
    return 'WHITELIST';
  }

  return 'UNKNOWN';
}

// ──────────────────────────────────────────────────────────────────────────────
// Permission file loading
// ──────────────────────────────────────────────────────────────────────────────

export function loadPermissions(filePath: string): PermissionContract {
  if (!fs.existsSync(filePath)) {
    logger.warn({ filePath }, 'ToakBox: Permission file not found, using safe defaults');
    return DEFAULT_PERMISSIONS;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as PermissionContract;
    logger.info({ filePath }, 'ToakBox: Permissions loaded');
    return { ...DEFAULT_PERMISSIONS, ...parsed };
  } catch (err) {
    logger.error({ filePath, err }, 'ToakBox: Failed to parse permission file, using defaults');
    return DEFAULT_PERMISSIONS;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Request parsing
// ──────────────────────────────────────────────────────────────────────────────

export function parseRequest(raw: string): ScheduleRequest | null {
  try {
    const parsed = JSON.parse(raw) as ScheduleRequest;
    if (parsed.type !== 'schedule_request') return null;
    if (!parsed.from || !parsed.action) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit logging
// ──────────────────────────────────────────────────────────────────────────────

function auditLog(
  request: ScheduleRequest,
  decision: DecisionResult,
  outcome: string,
  collabFile?: string,
): void {
  const entry = `[ToakBox] ${new Date().toISOString()} | ${request.from} → ${request.action} | ${decision} | ${outcome}`;

  logger.info({ request, decision, outcome }, 'ToakBox: Decision logged');

  if (collabFile) {
    try {
      fs.appendFileSync(collabFile, `\n${entry}`);
    } catch (err) {
      logger.warn({ err, collabFile }, 'ToakBox: Failed to write collab audit log');
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Rate limiting (per-agent, per-day)
// ──────────────────────────────────────────────────────────────────────────────

const agentDailyCount: Map<string, { count: number; date: string }> = new Map();

function isRateLimited(agentId: string, maxPerDay: number): boolean {
  const today = new Date().toISOString().split('T')[0];
  const entry = agentDailyCount.get(agentId);

  if (!entry || entry.date !== today) {
    agentDailyCount.set(agentId, { count: 1, date: today });
    return false;
  }

  if (entry.count >= maxPerDay) {
    return true;
  }

  entry.count++;
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// ToakBox daemon (main export)
// ──────────────────────────────────────────────────────────────────────────────

interface ToakBoxDeps {
  // These are injected so ToakBox doesn't need direct MCP access
  // (MCP tools are only available inside the agent container context)
  checkInbox: () => Promise<Array<{ from: string; message: string; id: string }>>;
  sendToAgent: (to: string, message: string) => Promise<void>;
  requestApproval: (action: string, context: string, timeoutMinutes: number) => Promise<boolean>;
  scheduleTask: (request: ScheduleRequest) => Promise<string>;
  cancelTask: (taskId: string) => Promise<void>;
  wakeAgent: (agentId: string, message: string) => Promise<void>;
  auditLog?: AuditLogger['log'];
  getActiveScheduleCount?: (agentId: string) => Promise<number>;
}

export class ToakBox {
  private permissions: PermissionContract;
  private lastPermissionLoad = 0;
  private running = false;

  constructor(
    private config: ToakBoxConfig,
    private deps: ToakBoxDeps,
  ) {
    this.permissions = loadPermissions(config.permissionFilePath);
  }

  private async refreshPermissionsIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPermissionLoad > this.config.permissionRefreshMs) {
      this.permissions = loadPermissions(this.config.permissionFilePath);
      this.lastPermissionLoad = now;
    }
  }

  private async handleRequest(from: string, raw: string): Promise<void> {
    const request = parseRequest(raw);

    if (!request) {
      logger.debug({ from, raw: raw.slice(0, 100) }, 'ToakBox: Ignoring non-schedule message');
      return;
    }

    logger.info({ request }, 'ToakBox: Received schedule request');

    // Rate limit check
    if (
      isRateLimited(
        request.from,
        this.permissions.settings.max_schedules_per_agent_per_day,
      )
    ) {
      await this.deps.sendToAgent(
        request.from,
        `❌ Rate limit exceeded. Max ${this.permissions.settings.max_schedules_per_agent_per_day} schedules per day.`,
      );
      auditLog(request, 'BLACKLIST', 'Rate limited', this.config.collab_file);
      return;
    }

    await this.refreshPermissionsIfNeeded();

    // Max active schedules check
    if (request.action !== 'cancel') {
      const activeCount = await this.deps.getActiveScheduleCount?.(request.from) ?? 0;
      const maxActive = this.permissions.settings.max_active_schedules_per_agent ?? 5;
      if (activeCount >= maxActive) {
        if (this.deps.auditLog) {
          await this.deps.auditLog({
            from_agent: request.from,
            action: request.action,
            command: request.command,
            decision: 'REJECTED',
            outcome: 'max_active_schedules_exceeded',
            metadata: { activeCount, maxActive },
          });
        }
        await this.deps.sendToAgent(request.from,
          `REJECTED: You have ${activeCount} active schedules (max ${maxActive}). Cancel some before scheduling more.`
        );
        return;
      }
    }

    const decision = evaluate(request, this.permissions);

    if (decision === 'BLACKLIST') {
      await this.deps.sendToAgent(
        request.from,
        `❌ Request rejected — command not permitted by ToakBox policy.`,
      );
      auditLog(request, 'BLACKLIST', 'Rejected', this.config.collab_file);
      return;
    }

    if (decision === 'WHITELIST') {
      await this.execute(request);
      auditLog(request, 'WHITELIST', 'Executed', this.config.collab_file);
      return;
    }

    // UNKNOWN — ask Treebird
    if (!this.permissions.settings.require_approval_for_unknown) {
      // If configured to auto-reject unknowns
      await this.deps.sendToAgent(
        request.from,
        `❌ Unknown request — approval required but auto-reject is enabled.`,
      );
      auditLog(request, 'UNKNOWN', 'Auto-rejected', this.config.collab_file);
      return;
    }

    const approvalContext =
      `**${request.from}** wants to: ${request.action}\n` +
      `Command: \`${request.command ?? 'N/A'}\`\n` +
      `Reason: ${request.reason ?? 'No reason given'}\n` +
      `Timezone: ${request.timezone ?? 'UTC'}`;

    logger.info({ request }, 'ToakBox: Requesting Treebird approval');

    const approved = await this.deps.requestApproval(
      `ToakBox: ${request.from} wants to schedule "${request.command ?? request.action}"`,
      approvalContext,
      this.permissions.settings.approval_timeout_minutes,
    );

    if (approved) {
      await this.execute(request);
      await this.deps.sendToAgent(request.from, `✅ Approved and scheduled!`);
      auditLog(request, 'UNKNOWN', 'Approved + executed', this.config.collab_file);
    } else {
      await this.deps.sendToAgent(request.from, `❌ Not approved by Treebird.`);
      auditLog(request, 'UNKNOWN', 'Rejected by Treebird', this.config.collab_file);
    }
  }

  private async execute(request: ScheduleRequest): Promise<void> {
    try {
      if (request.action === 'cancel') {
        if (!request.taskId) {
          await this.deps.sendToAgent(request.from, `❌ Cancel requires a taskId.`);
          return;
        }
        await this.deps.cancelTask(request.taskId);
        await this.deps.sendToAgent(request.from, `✅ Task ${request.taskId} cancelled.`);
        return;
      }

      if (request.action === 'wake_agent') {
        if (!request.agent) {
          await this.deps.sendToAgent(request.from, `❌ wake_agent requires an agent ID.`);
          return;
        }
        await this.deps.wakeAgent(request.agent, `Wake-up call from ${request.from} via ToakBox`);
        await this.deps.sendToAgent(request.from, `✅ Wake-up sent to ${request.agent}.`);
        return;
      }

      const taskId = await this.deps.scheduleTask(request);
      await this.deps.sendToAgent(
        request.from,
        `✅ Scheduled! Task ID: \`${taskId}\`\nAction: ${request.action} — \`${request.command}\``,
      );
    } catch (err) {
      logger.error({ err, request }, 'ToakBox: Execution failed');
      await this.deps.sendToAgent(
        request.from,
        `❌ Failed to schedule: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async tick(): Promise<void> {
    try {
      const messages = await this.deps.checkInbox();
      for (const msg of messages) {
        await this.handleRequest(msg.from, msg.message);
      }
    } catch (err) {
      logger.error({ err }, 'ToakBox: Error in daemon tick');
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info({ pollIntervalMs: this.config.pollIntervalMs }, 'ToakBox: Daemon started');

    const loop = async () => {
      if (!this.running) return;
      await this.tick();
      setTimeout(loop, this.config.pollIntervalMs);
    };

    loop();
  }

  stop(): void {
    this.running = false;
    logger.info('ToakBox: Daemon stopped');
  }
}
