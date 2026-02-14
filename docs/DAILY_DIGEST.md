# Daily Digest System

## Overview

The Daily Digest system automatically generates morning briefings by scanning TLDR sections from collab files across the flock.

## Features

- **TLDR Parsing**: Extracts structured summaries from daily collab logs
- **Multi-Agent**: Scans all mounted flock directories
- **Categorization**: Groups entries by hashtags (security, content, integration, etc.)
- **Scheduled**: Runs daily at 9 AM local time
- **Discord Integration**: Posts formatted digest to main channel

## TLDR Format

Add a `## TLDR` section to your daily collab files with this format:

```markdown
## TLDR
- `17:00` **Container hardening** — Debian→Alpine, 144→39 CVEs #security #docker → [[2026-02-12-daily#container-security]]
- `18:43` **GitHub OSS podcasts** — 2 episodes with different voices #content #elevenlabs
- `12:30` **Watsan integration** — Knowledge graph now has 17 entities #integration #watsan
```

### Format Specification:

- **Timestamp**: `` `17:00` `` - Time in backticks
- **Title**: `**Container hardening**` - Bold text
- **Separator**: ` — ` - Em dash (not hyphen)
- **Description**: Free-form text with `#hashtags`
- **Wikilink** (optional): ` → [[2026-02-12-daily#section]]`

### Supported Hashtags:

- `#security` - Security improvements, CVE fixes
- `#content` - Podcasts, articles, documentation
- `#integration` - New integrations, MCP servers
- `#bugfix` - Bug fixes
- `#feature` - New features
- Other hashtags categorized as "other"

## Setup

### 1. Create the scheduled task:

**Post to main channel:**
```bash
cd /workspace/project
npm run build
npx tsx src/setup-daily-digest-task.ts
```

**Post to a specific channel (e.g., TLDR forum):**
```bash
npx tsx src/setup-daily-digest-task.ts <CHANNEL_JID>
```

Example for Serversan TLDR forum:
```bash
npx tsx src/setup-daily-digest-task.ts 1471865775827718185
```

This creates a scheduled task that runs at 9 AM every day and posts to the specified channel.

### 2. Configure collab paths:

The digest scans these directories by default:
- `/workspace/extra/toak/collab/daily/`
- `/workspace/extra/watsan/logs/` (if available)
- `/workspace/extra/sancast/` (if available)

To add more directories, modify the `collabPaths` in the scheduled task prompt or create a custom task.

## Testing

Test the digest generator manually:

```bash
cd /workspace/project
npx tsx src/test-digest.ts
```

This reads yesterday's TLDR sections and generates a sample digest.

## Output Example

```
🌅 **Daily Flock Digest — February 12, 2026**

**Yesterday's Highlights** (3 activities):

🔒 **Container hardening** (17:00) [toak] — Debian→Alpine, 144→39 CVEs #security #docker
🎙️ **GitHub OSS podcasts** (18:43) [sansan] — 2 episodes with different voices #content #elevenlabs
🔌 **Watsan integration** (12:30) [watsan] — Knowledge graph now has 17 entities #integration #watsan

_Full details in collab logs_

<!-- generated:nanoclaw:sansan-digest | updated:2026-02-13T09:00:00.000Z -->
```

## HTML Comment Marker

The digest includes an HTML comment for tracking:

```html
<!-- generated:nanoclaw:sansan-digest | updated:2026-02-13T09:00:00.000Z -->
```

This allows other agents to identify and update the digest programmatically.

## Manual Digest Generation

To generate a digest on-demand, message Sansan:

```
@sansan generate daily digest
```

Or use the MCP tool from within a container:

```typescript
import { generateDailyDigest } from './digest-generator.js';

const message = await generateDailyDigest([
  '/workspace/extra/toak/collab/daily/',
  '/workspace/extra/watsan/logs/',
]);

console.log(message);
```

## Troubleshooting

### No entries found

- Check that collab files have a `## TLDR` section
- Verify the date format: `YYYY-MM-DD-daily.md`
- Ensure TLDR entries match the format specification

### Entries not categorized

- Add hashtags to descriptions: `#security #docker`
- Use supported category tags (see list above)

### Scheduled task not running

Check task status:

```bash
sqlite3 /workspace/project/store/messages.db "SELECT * FROM scheduled_tasks WHERE prompt LIKE '%daily digest%';"
```

Verify next_run time and status='active'.

## Future Enhancements

- ElevenLabs audio version (when API keys available)
- Wikilink following for deep-dive topics
- "What's Next" section from pending tasks
- "Needs Attention" section from stuck tasks
