# Setup Daily Digest for TLDR Forum

## Quick Start

To post daily digests to the Serversan TLDR forum channel:

```bash
cd /workspace/project
npm run build

# Post to TLDR forum (replace with actual TLDR forum channel ID)
npx tsx src/setup-daily-digest-task.ts <TLDR_FORUM_CHANNEL_ID>
```

## Finding the Channel ID

1. Check available Discord channels:
```bash
cat /workspace/ipc/available_groups.json
```

2. Look for the TLDR forum channel in the list

3. Copy its `jid` value

## Example

If the TLDR forum channel ID is `1471865775827718185`:

```bash
npx tsx src/setup-daily-digest-task.ts 1471865775827718185
```

Output:
```
Target channel: 1471865775827718185
✅ Daily digest task created successfully!
Task ID: daily-digest-1707838800000
Schedule: Every day at 9 AM (America/New_York)
Next run: 2026-02-14T14:00:00.000Z
The digest will automatically post to channel 1471865775827718185 each morning.
```

## Verify Setup

Check that the task was created:

```bash
sqlite3 /workspace/project/store/messages.db "
  SELECT id, chat_jid, schedule_value, next_run, status
  FROM scheduled_tasks
  WHERE prompt LIKE '%daily digest%';
"
```

## Multiple Channels

You can post to multiple channels by running the setup script multiple times with different channel IDs:

```bash
# Post to TLDR forum
npx tsx src/setup-daily-digest-task.ts 1471865775827718185

# Also post to announcements
npx tsx src/setup-daily-digest-task.ts 1471143943059144736
```

## Manual Test

To test the digest without waiting for 9 AM:

```bash
npx tsx src/test-digest.ts
```

Or message Sansan:
```
@sansan generate daily digest
```

## Troubleshooting

### Channel not receiving digests

1. **Check task status**:
```bash
sqlite3 store/messages.db "SELECT * FROM scheduled_tasks WHERE prompt LIKE '%daily digest%';"
```

2. **Check service is running**:
```bash
launchctl list | grep nanoclaw
```

3. **Check recent errors**:
```bash
grep ERROR logs/nanoclaw.log | tail -20
```

4. **Verify channel ID**:
```bash
cat /workspace/ipc/available_groups.json | grep -A2 "tldr"
```

### Permission issues

If Sansan can't post to the channel:
- Verify the bot has permission to post to that channel
- Check if the channel requires a specific role
- Ensure the channel is in the same Discord server

## Updating the Channel

To change which channel receives digests:

1. Delete the old task:
```bash
sqlite3 store/messages.db "DELETE FROM scheduled_tasks WHERE id='daily-digest-...';"
```

2. Create a new task with the correct channel:
```bash
npx tsx src/setup-daily-digest-task.ts <NEW_CHANNEL_ID>
```

3. Restart the service:
```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```
