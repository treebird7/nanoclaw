import { Router, Request, Response } from 'express';
import type { ToakBox } from '../toakbox.js';
import type { AuditLogger } from '../toakbox-audit.js';

export function createToakBoxRouter(toakbox: ToakBox, auditLogger: AuditLogger): Router {
  const router = Router();

  router.get('/status', async (req: Request, res: Response) => {
    const token = req.headers['x-auth-token'] as string;
    if (!token || token !== process.env.BRIDGE_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const baseStatus = toakbox.status;
      const todayStats = await auditLogger.getTodayStats();

      res.json({
        ...baseStatus,
        todayStats: {
          approved: todayStats.approved + todayStats.whitelisted,
          rejected: todayStats.rejected + todayStats.blacklisted,
          escalated: todayStats.escalated,
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get status', detail: (err as Error).message });
    }
  });

  return router;
}
