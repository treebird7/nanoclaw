import { createClient } from '@supabase/supabase-js';

interface AuditEntry {
  from_agent: string;
  action: string;
  command?: string;
  decision: 'WHITELIST' | 'BLACKLIST' | 'UNKNOWN' | 'APPROVED' | 'REJECTED';
  outcome?: string;
  task_id?: string;
  metadata?: Record<string, unknown>;
}

export function createAuditLogger(supabaseUrl?: string, serviceRoleKey?: string) {
  const url = supabaseUrl || process.env.SUPABASE_URL;
  const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      log: async (_entry: AuditEntry) => {
        console.warn('[toakbox-audit] Supabase not configured, skipping audit log');
      },
      getTodayStats: async () => ({ approved: 0, rejected: 0, escalated: 0, whitelisted: 0, blacklisted: 0 }),
    };
  }

  const supabase = createClient(url, key);

  return {
    log: async (entry: AuditEntry): Promise<void> => {
      const { error } = await supabase.from('toakbox_audit_log').insert(entry);
      if (error) {
        console.error('[toakbox-audit] Failed to persist audit entry:', error.message);
        // Don't throw — audit failure must not crash ToakBox
      }
    },

    getTodayStats: async () => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('toakbox_audit_log')
        .select('decision')
        .gte('requested_at', startOfDay.toISOString());

      if (error || !data) return { approved: 0, rejected: 0, escalated: 0, whitelisted: 0, blacklisted: 0 };

      return {
        approved: data.filter((r) => r.decision === 'APPROVED').length,
        rejected: data.filter((r) => r.decision === 'REJECTED' || r.decision === 'BLACKLIST').length,
        escalated: data.filter((r) => r.decision === 'UNKNOWN').length,
        whitelisted: data.filter((r) => r.decision === 'WHITELIST').length,
        blacklisted: data.filter((r) => r.decision === 'BLACKLIST').length,
      };
    },
  };
}

export type AuditLogger = ReturnType<typeof createAuditLogger>;
