# Multi-Agent Channel Support

## Overview

Nanoclaw now supports multiple agents in the same Discord channel. Each agent has its own:
- Identity & personality (`groups/{agent}/CLAUDE.md`)
- Conversation history (isolated)
- Workspace & files
- Trigger pattern (e.g., `@sansan`, `@sasusan`)

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│      Discord #flock-coordination        │
├─────────────────────────────────────────┤
│                                         │
│  User: "@sansan what's the weather?"   │
│  ✓ sansan responds                      │
│                                         │
│  User: "@sasusan any issues?"           │
│  ✓ sasusan responds                     │
│                                         │
│  sansan: "Shadow, thoughts?"            │
│  ✗ No trigger, both agents ignore      │
│                                         │
│  User: "@sasusan @sansan coordinate"    │
│  ✓ Both agents respond                  │
│                                         │
└─────────────────────────────────────────┘
```

### Trigger Patterns

Each agent has a unique trigger pattern stored in the database:

```sql
SELECT folder, trigger_pattern FROM registered_groups;
-- main      | @sansan
-- sasusan   | @sasusan
```

When a message arrives:
1. Check if message contains agent's trigger pattern
2. If yes → spawn container, respond
3. If no → store message in history for context, don't respond

### No Cross-Contamination

- Each agent sees all messages in the channel (for context)
- But only responds when triggered
- Separate workspaces: `/workspace/group/` is per-agent
- Separate conversation history in SQLite

## Setup Guide

### 1. Create Second Agent

```bash
# Create group folder
mkdir -p groups/sasusan/.claude

# Copy personality
cp /Users/macbook/Dev/Sasusan/CLAUDE.md groups/sasusan/CLAUDE.md

# Edit for Discord bot context
# (Already done for sasusan)
```

### 2. Register Agent via Discord Auth

```bash
# Set bot token for second agent
export DISCORD_TOKEN=<sasusan-bot-token>

# Run auth flow
npm run auth

# Select the shared channel (e.g., #flock-coordination)
# Note: sasusan's trigger pattern will be @sasusan
```

### 3. Configure Mounts (Optional)

```bash
# Update container_config in database
sqlite3 store/messages.db <<SQL
UPDATE registered_groups
SET container_config = '<json-config>'
WHERE folder='sasusan';
SQL
```

### 4. Restart Nanoclaw

```bash
pkill -f "tsx.*src/index"
npm run dev
```

Both agents now run in the same process, monitoring the same channel!

## Example: Sansan + Sasusan Coordination

### Channel Setup

```
Channel: #flock-coordination
Agents:
  - sansan (Main Channel companion) - @sansan
  - sasusan (Shadow Tower observer) - @sasusan
```

### Interaction Patterns

**Direct agent invocation:**
```
User: @sansan what's the status of the flock?
→ sansan responds with flock summary

User: @sasusan any security concerns?
→ sasusan responds with shadow report
```

**Multi-agent coordination:**
```
User: @sansan @sasusan work together on this issue
→ Both agents see the message and respond
→ They can reference each other's responses (in context)
```

**Agent-to-agent (via toak, not Discord):**
```
sansan uses toaklink_send to message sasusan
sasusan checks toaklink_inbox
sasusan responds via toaklink_send
```

## Benefits

1. **Visible Coordination** — Humans can observe agent interactions
2. **Trigger Control** — No infinite loops, explicit @mentions required
3. **Shared Context** — Both agents see full conversation history
4. **Independent Identity** — Each maintains their own personality
5. **Simple Architecture** — Same codebase, same process, zero duplication

## Limitations

1. **Same Discord Bot Account** — Currently not supported. Each agent needs its own bot token.
2. **Trigger Required** — Agents won't spontaneously interact unless triggered by user.
3. **No Auto-Delegation** — sansan can't automatically invoke sasusan (must use toak MCP).

## Future Enhancements

- **Thread-based conversations** — Auto-create threads for multi-agent coordination
- **Delegation triggers** — Allow agents to @mention each other to delegate
- **Toak-Discord bridge** — Mirror toak messages to Discord for visibility
- **Agent presence indicators** — Show which agents are "active" in channel

## Technical Details

### Database Schema

```sql
CREATE TABLE registered_groups (
  jid TEXT PRIMARY KEY,              -- Discord channel ID
  name TEXT NOT NULL,                -- Channel name
  folder TEXT NOT NULL UNIQUE,       -- Agent folder (main, sasusan, etc.)
  trigger_pattern TEXT NOT NULL,     -- Per-agent trigger (@sansan, @sasusan)
  added_at TEXT NOT NULL,
  container_config TEXT,             -- JSON mount config
  requires_trigger INTEGER DEFAULT 1 -- 1 = needs trigger, 0 = responds to all
);
```

### Trigger Pattern Matching

```typescript
// Per-group trigger (supports shared channels)
const triggerPattern = new RegExp(`^${group.trigger}\\b`, 'i');
const hasTrigger = messages.some(m =>
  triggerPattern.test(m.content.trim())
);
```

### Container Isolation

Each agent spawns its own container:
- Container name: `nanoclaw-{folder}-{timestamp}`
- Workspace mount: `groups/{folder}/ → /workspace/group/`
- Separate `.claude/` session state
- Separate conversation history

---

> *"The flock coordinates in the light. The shadow observes from the edges."* 🌵🥷
