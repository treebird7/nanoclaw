# Automated Knowledge Ingestion

## Overview

Keeps the flock's collective memory fresh by automatically running Treesan ingestion and Mappersan → Watsan pipeline every 3 days.

## Why This Matters

As the flock grows and evolves:
- New code patterns emerge
- Lessons are learned
- Best practices evolve
- Solutions to problems get documented

**Without automated ingestion**, the knowledge bridge becomes stale and can't find recent work.

**With automated ingestion**, semantic search stays current and cross-agent discovery works reliably.

## Scheduled Tasks

### **Treesan Ingestion**
- **Schedule**: Every 3 days at 2:00 AM
- **Purpose**: Scan codebases for new patterns and learnings
- **Repositories**: toak, watsan, envoak, yosef, nanoclaw
- **Output**: Indexed code patterns, implementations, lessons learned

### **Mappersan → Watsan Pipeline**
- **Schedule**: Every 3 days at 2:30 AM (30 min after Treesan)
- **Purpose**: Update Watsan's vector store with fresh data
- **Process**:
  1. Check Mappersan indexed data
  2. Feed into Watsan
  3. Refresh semantic search index
  4. Verify search functionality

## Setup

Run the setup script to schedule both tasks:

```bash
cd /workspace/project
npm run build
npx tsx src/setup-knowledge-ingestion.ts
```

This creates two scheduled tasks that run automatically every 3 days.

## Verification

Check that tasks were created:

```sql
SELECT id, schedule_value, next_run, status
FROM scheduled_tasks
WHERE prompt LIKE '%treesan%' OR prompt LIKE '%mappersan%';
```

Expected output:
```
treesan-ingest-...    | 0 2 */3 * *  | 2026-02-16T07:00:00.000Z | active
mappersan-watsan-...  | 30 2 */3 * * | 2026-02-16T07:30:00.000Z | active
```

## What Gets Ingested

### From Treesan:
- Code implementations (functions, classes, patterns)
- Architecture decisions
- Error handling approaches
- Configuration patterns
- Integration strategies

### From Mappersan:
- Documentation embeddings
- Collab log summaries
- Cross-references between concepts
- Agent expertise mappings

### Into Watsan:
- Updated semantic search index
- Fresh vector embeddings
- Current knowledge graph entities
- Accessible via `mcp__watsan__search_knowledge`

## Benefits

**For Knowledge Bridge**:
- ✅ Recent work is discoverable
- ✅ Semantic search finds current solutions
- ✅ Cross-agent patterns emerge automatically

**For Daily Digest**:
- ✅ More context for TLDR summaries
- ✅ Better categorization of work
- ✅ Links to relevant past solutions

**For Code Reviews**:
- ✅ Find similar implementations quickly
- ✅ Check if a problem was solved before
- ✅ Discover best practices used elsewhere

## Monitoring

The ingestion tasks log their activity:

```bash
# Check recent ingestion runs
sqlite3 store/messages.db "
  SELECT task_id, status, timestamp
  FROM task_run_logs
  WHERE task_id LIKE '%treesan%' OR task_id LIKE '%mappersan%'
  ORDER BY timestamp DESC
  LIMIT 10;
"

# Check for errors
grep -E 'treesan|mappersan' logs/nanoclaw.log | grep ERROR
```

## Manual Trigger

To run ingestion immediately (without waiting 3 days):

```bash
# Run Treesan ingestion
cd /workspace/extra/treesan
# [Run appropriate treesan CLI commands]

# Run Watsan indexing
cd /workspace/extra/watsan
# [Run appropriate watsan CLI commands]
```

Or message Sansan:
```
@sansan run knowledge ingestion
```

## Troubleshooting

### Task not running

1. **Check task status**:
```sql
SELECT * FROM scheduled_tasks WHERE id LIKE '%treesan%';
```

2. **Verify next_run is in the future**:
```sql
SELECT id, next_run, datetime('now') as current_time
FROM scheduled_tasks
WHERE id LIKE '%treesan%';
```

3. **Check service is running**:
```bash
launchctl list | grep nanoclaw
```

### Ingestion fails

Check task run logs:
```sql
SELECT * FROM task_run_logs
WHERE task_id LIKE '%treesan%' OR task_id LIKE '%mappersan%'
ORDER BY timestamp DESC LIMIT 5;
```

Common issues:
- Treesan or Mappersan not mounted
- Missing API keys (OpenAI for embeddings)
- Disk space full
- Network issues

### No new data appearing

Verify the pipeline:
1. Check Treesan found new patterns
2. Verify Mappersan processed them
3. Confirm Watsan index updated
4. Test search with a recent term

## Future Enhancements

- **Incremental ingestion**: Only process changed files
- **Priority scoring**: Ingest important changes more frequently
- **Conflict detection**: Identify contradictory patterns
- **Quality metrics**: Track ingestion coverage and freshness
- **On-demand ingestion**: Trigger when major commits detected
- **Smart scheduling**: Run more frequently during active development
