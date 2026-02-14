# Task Visibility Dashboard

## Overview

The Task Dashboard provides hourly status updates on all scheduled tasks across the flock. It automatically detects and alerts on stuck tasks, status changes, and system health.

## Features

- **Real-time Status**: Total tasks by status (active, paused, completed)
- **Group Breakdown**: See which groups have the most tasks
- **Stuck Detection**: Automatically identifies tasks that should have run but didn't
- **Smart Suppression**: Only posts when changes detected (no spam)
- **Hourly Updates**: Runs at the top of every hour

## Setup

Run the setup script to schedule the hourly dashboard:

```bash
cd /workspace/project
npm run build
npx tsx src/setup-task-dashboard.ts
```

This creates a scheduled task that runs at :00 every hour.

## Output Example

```
📊 **Task Dashboard**

**Status Overview**:
• Total Tasks: 5
• 🟢 Active: 3
• ⏸️ Paused: 1
• ✅ Completed: 1
• ⚠️ **Stuck**: 2

**Tasks by Group**:
• main: 3
• dev-team: 2

**⚠️ Needs Attention** (2 stuck tasks):
• [main] Generate daily digest from yesterday's TLDR entries...
  _Should have run 15 minutes ago_
• [dev-team] Run integration tests...
  _Should have run 45 minutes ago_

✅ All scheduled tasks are running on time!

_Last updated: 2:00:00 PM_
```

## Smart Suppression

The dashboard only posts when:
- Active task count changes
- Paused task count changes
- Stuck task count changes
- Stuck tasks list changes

If nothing changed since the last report, the dashboard runs silently (no Discord post).

## On-Demand Status

You can request the dashboard anytime:

```
@sansan task status
```

Or:

```
@sansan show task dashboard
```

## Integration with Other Tools

### From TypeScript:

```typescript
import { generateTaskDashboard, generateTaskSummary } from './task-dashboard.js';

// Get formatted message
const message = generateTaskDashboard();

// Get raw summary data
const summary = generateTaskSummary();
console.log(`Active: ${summary.active}, Stuck: ${summary.stuck}`);
```

### From SQL:

```sql
-- Check all active tasks
SELECT id, group_folder, prompt, next_run
FROM scheduled_tasks
WHERE status='active'
ORDER BY next_run;

-- Find stuck tasks
SELECT id, group_folder, prompt, next_run
FROM scheduled_tasks
WHERE status='active' AND next_run < datetime('now');

-- Task counts by group
SELECT group_folder, COUNT(*) as count
FROM scheduled_tasks
WHERE status='active'
GROUP BY group_folder;
```

## Task States

- **active**: Task is scheduled and will run
- **paused**: Task is temporarily disabled
- **completed**: One-time task finished successfully
- **stuck**: Active task with next_run in the past (needs investigation)

## Troubleshooting Stuck Tasks

When a task shows as stuck:

1. **Check the service**: `launchctl list | grep nanoclaw`
2. **Check recent errors**: `grep ERROR logs/nanoclaw.log | tail -20`
3. **Check task logs**: `sqlite3 store/messages.db "SELECT * FROM task_run_logs WHERE task_id='...' ORDER BY timestamp DESC LIMIT 5;"`
4. **Manually trigger**: Use the MCP `schedule_task` tool to test

### Common Causes:

- Service was stopped/crashed
- Container timeout (task took >30 minutes)
- Database locked (concurrent access issue)
- Invalid cron expression
- Timezone misconfiguration

## Monitoring Metrics

The dashboard tracks:
- **Total tasks**: All scheduled tasks in the system
- **Active ratio**: Active / Total (should be high)
- **Stuck rate**: Stuck / Active (should be near zero)
- **Group distribution**: Tasks spread across groups

### Healthy System:
- Active ratio: >70%
- Stuck rate: <5%
- No tasks stuck for >1 hour

### Degraded System:
- Active ratio: 50-70%
- Stuck rate: 5-15%
- Some tasks stuck for >1 hour

### Critical System:
- Active ratio: <50%
- Stuck rate: >15%
- Many tasks stuck for >2 hours

## Future Enhancements

- Discord embed formatting (colors, fields)
- Clickable buttons ("Retry Task", "Pause Task")
- Failure rate trends (last 24 hours)
- Task completion time averages
- Slack integration for alerts
- Mobile-friendly formatting
