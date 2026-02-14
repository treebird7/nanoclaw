#!/usr/bin/env node
/**
 * Setup automated knowledge ingestion tasks
 * Keeps the flock's collective memory fresh
 */
import { initDatabase, createTask, getAllRegisteredGroups } from './db.js';
import { CronExpressionParser } from 'cron-parser';
import { TIMEZONE, MAIN_GROUP_FOLDER } from './config.js';

async function setupKnowledgeIngestion() {
  // Initialize database first
  initDatabase();

  const groups = getAllRegisteredGroups();
  const mainGroup = Object.entries(groups).find(([, group]) => group.folder === MAIN_GROUP_FOLDER);

  if (!mainGroup) {
    console.error('Main group not found');
    process.exit(1);
  }

  const [mainGroupJid] = mainGroup;

  // Schedule for every 3 days at 2 AM
  const cronExpression = '0 2 */3 * *';

  const interval = CronExpressionParser.parse(cronExpression, {
    tz: TIMEZONE,
    currentDate: new Date(),
  });
  const nextRun = interval.next().toISOString();

  // Task 1: Treesan Ingestion
  const treesanTaskId = `treesan-ingest-${Date.now()}`;
  createTask({
    id: treesanTaskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: mainGroupJid,
    prompt: `Run Treesan ingestion to scan codebases and extract learnings.

Execute the Treesan CLI to:
1. Scan all mounted flock repositories for new code patterns
2. Extract implementations, lessons learned, and best practices
3. Index findings for future knowledge searches

This keeps the knowledge bridge current with recent work.

Commands to run:
- Check if treesan is available in /workspace/extra/treesan
- Run treesan ingest across key repos (toak, watsan, envoak, yosef)
- Log results to collab

If treesan is not mounted or errors occur, log the issue and skip silently.`,
    schedule_type: 'cron',
    schedule_value: cronExpression,
    context_mode: 'group',
    next_run: nextRun,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  // Task 2: Mappersan → Watsan Pipeline
  const mapperTaskId = `mappersan-watsan-${Date.now()}`;
  // Offset by 30 minutes so they don't run simultaneously
  const cronExpression2 = '30 2 */3 * *';
  const interval2 = CronExpressionParser.parse(cronExpression2, {
    tz: TIMEZONE,
    currentDate: new Date(),
  });
  const nextRun2 = interval2.next().toISOString();

  createTask({
    id: mapperTaskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: mainGroupJid,
    prompt: `Run Mappersan → Watsan knowledge pipeline to refresh semantic search.

Execute the knowledge indexing pipeline:
1. Check if Mappersan data is available
2. Process indexed data and feed into Watsan
3. Update Watsan's vector store and semantic search index
4. Verify knowledge base is accessible

This ensures the knowledge bridge semantic search stays current.

Commands to run:
- Check Watsan CLI availability
- Run knowledge base update/refresh commands
- Verify search functionality with a test query
- Log results to collab

If tools are not available or errors occur, log the issue and skip silently.`,
    schedule_type: 'cron',
    schedule_value: cronExpression2,
    context_mode: 'group',
    next_run: nextRun2,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  console.log('✅ Knowledge ingestion tasks scheduled successfully!');
  console.log('\nTreesan Ingestion:');
  console.log(`  Task ID: ${treesanTaskId}`);
  console.log(`  Schedule: Every 3 days at 2:00 AM (${TIMEZONE})`);
  console.log(`  Next run: ${nextRun}`);

  console.log('\nMappersan → Watsan Pipeline:');
  console.log(`  Task ID: ${mapperTaskId}`);
  console.log(`  Schedule: Every 3 days at 2:30 AM (${TIMEZONE})`);
  console.log(`  Next run: ${nextRun2}`);

  console.log('\nThese tasks will keep the flock\'s collective memory fresh automatically.');
}

setupKnowledgeIngestion().catch((err) => {
  console.error('Failed to setup knowledge ingestion:', err);
  process.exit(1);
});
