# Handoff: Add Discord Voice Transcription

## Context

**For**: Claude Code
**Goal**: Implement voice message transcription for Discord, then create a `/add-discord-voice-transcription` skill for the nanoclaw repo

**Why This Matters**:
- User can send voice messages in Discord
- Sansan transcribes them automatically using OpenAI Whisper
- Enables hands-free communication (driving, walking, etc.)
- Cost: ~$0.006/minute (~$0.003 per 30-second voice note)

## Current State

**What Exists**:
- ✅ `/workspace/project/.claude/skills/add-voice-transcription/SKILL.md` - WhatsApp version
- ✅ OpenAI API key already stored in Envoak (`/workspace/group/config.enc`)
- ✅ Discord integration working (replaced WhatsApp)
- ✅ Main Discord handler at `src/discord.ts`

**What Needs Adaptation**:
- ❌ Existing skill is for WhatsApp (Baileys library)
- ❌ Needs Discord.js voice message handling
- ❌ Needs Envoak integration (not config file)

## Implementation Tasks

### Step 1: Install OpenAI SDK

Add to `package.json`:
```json
"dependencies": {
  "openai": "^4.77.0"
}
```

**Important**: Use `npm install --legacy-peer-deps` (OpenAI SDK uses Zod v3, nanoclaw uses Zod v4)

### Step 2: Create Discord Voice Transcription Module

Create `src/transcription.ts`:

```typescript
import OpenAI from 'openai';
import { Attachment } from 'discord.js';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client with API key from environment
 */
export function initTranscription() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not found - voice transcription disabled');
    return;
  }

  openaiClient = new OpenAI({ apiKey });
  logger.info('Voice transcription initialized');
}

/**
 * Download Discord voice attachment to temporary file
 */
async function downloadVoiceAttachment(attachment: Attachment): Promise<string | null> {
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const tempPath = path.join('/tmp', `voice-${Date.now()}.${attachment.name?.split('.').pop() || 'ogg'}`);

    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  } catch (err) {
    logger.error({ err, url: attachment.url }, 'Failed to download voice attachment');
    return null;
  }
}

/**
 * Transcribe a Discord voice message attachment
 */
export async function transcribeVoiceMessage(attachment: Attachment): Promise<string | null> {
  if (!openaiClient) {
    return '[Voice Message - transcription unavailable]';
  }

  try {
    // Download voice file
    const filePath = await downloadVoiceAttachment(attachment);
    if (!filePath) return null;

    // Transcribe with Whisper
    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });

    // Cleanup temp file
    fs.unlinkSync(filePath);

    logger.info({ text: transcription.text.slice(0, 50) }, 'Voice transcribed');
    return transcription.text;

  } catch (err) {
    logger.error({ err }, 'Voice transcription failed');
    return '[Voice Message - transcription failed]';
  }
}

/**
 * Check if message has voice attachments
 */
export function hasVoiceAttachment(attachments: Attachment[]): boolean {
  return attachments.some(att =>
    att.contentType?.startsWith('audio/') ||
    ['ogg', 'mp3', 'm4a', 'wav'].some(ext => att.name?.endsWith(`.${ext}`))
  );
}
```

### Step 3: Integrate with Discord Message Handler

Update `src/discord.ts`:

1. **Import transcription module**:
```typescript
import { initTranscription, transcribeVoiceMessage, hasVoiceAttachment } from './transcription.js';
```

2. **Initialize on startup** (in `connectDiscord` function):
```typescript
export async function connectDiscord() {
  // ... existing code ...

  // Initialize voice transcription
  initTranscription();

  // ... rest of function ...
}
```

3. **Handle voice messages** (in the `messageCreate` event handler):
```typescript
client.on('messageCreate', async (message) => {
  // ... existing filtering (bots, etc.) ...

  let content = message.content;

  // Check for voice attachments
  if (message.attachments.size > 0 && hasVoiceAttachment(Array.from(message.attachments.values()))) {
    const voiceAttachment = Array.from(message.attachments.values()).find(att =>
      att.contentType?.startsWith('audio/') ||
      ['ogg', 'mp3', 'm4a', 'wav'].some(ext => att.name?.endsWith(`.${ext}`))
    );

    if (voiceAttachment) {
      const transcript = await transcribeVoiceMessage(voiceAttachment);
      if (transcript) {
        content = `[Voice: ${transcript}]`;
        logger.info({ transcript: transcript.slice(0, 50) }, 'Voice message transcribed');
      }
    }
  }

  // ... rest of message processing with content ...
});
```

### Step 4: Update Envoak Configuration

The OPENAI_API_KEY is already in Envoak at `/workspace/group/config.enc`.

Ensure it's injected into the MCP environment by checking `.mcp.json`:
```json
{
  "mcpServers": {
    "envoak": {
      "command": "bash",
      "args": ["/workspace/extra/envoak/launch-mcp.sh"],
      "env": {
        "ENVOAK_KEY": "${ENVOAK_KEY}"
      }
    }
  }
}
```

### Step 5: Test

1. **Build**:
```bash
npm run build
```

2. **Restart the service**:
```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

3. **Test with voice message**:
- Send a voice message in Discord
- Verify it gets transcribed
- Check logs: `grep "Voice transcribed" logs/nanoclaw.log`

## Creating the Skill

Once implemented and tested, create `/add-discord-voice-transcription` skill:

### File: `.claude/skills/add-discord-voice-transcription/SKILL.md`

Structure:
```markdown
---
name: add-discord-voice-transcription
description: Add voice message transcription for Discord using OpenAI Whisper API
---

# Add Discord Voice Message Transcription

[Copy implementation steps above, adapted as a skill guide]

## Prerequisites
- OpenAI API key
- Discord integration (not WhatsApp)
- Envoak for secure key storage (recommended)

## Implementation
[Step-by-step guide with code snippets]

## Configuration
[How to set up API key with Envoak or config file]

## Testing
[How to verify it works]

## Troubleshooting
[Common issues and solutions]

## Cost Management
- ~$0.006 per minute of audio
- ~$0.003 per typical 30-second voice note
- Monitor usage at platform.openai.com

## Removal Instructions
[How to uninstall if needed]
```

## Pull Request to nanoclaw

**After everything works**:

1. Create PR with:
   - New skill file: `.claude/skills/add-discord-voice-transcription/SKILL.md`
   - Clear description of Discord voice transcription
   - Mention it's adapted from WhatsApp version for Discord
   - Include cost info and prerequisites

2. PR Title: "Add Discord voice transcription skill using OpenAI Whisper API"

3. PR Description:
```markdown
New skill `/add-discord-voice-transcription` that guides users through adding
automatic voice message transcription for Discord.

Features:
- Uses OpenAI Whisper API for transcription (~$0.006/min)
- Discord.js attachment handling
- Envoak integration for secure API key storage
- Graceful fallback when transcription unavailable
- Voice messages stored as `[Voice: <transcript>]` in database

Adapted from the WhatsApp voice transcription skill (#77) for Discord compatibility.
```

## Success Criteria

- ✅ Voice messages in Discord get transcribed automatically
- ✅ Transcriptions appear as `[Voice: <transcript>]` in message content
- ✅ Agent can read and respond to voice messages
- ✅ Graceful fallback if API key missing or API fails
- ✅ Skill document is clear and complete
- ✅ PR merged to nanoclaw repo

## Notes

- Discord voice attachments have different handling than WhatsApp
- Discord.js uses `Attachment` objects with `contentType` and `url`
- Temp file storage in `/tmp/` for transcription processing
- Cleanup temp files after transcription
- Log transcription success/failure for debugging

## References

- Original WhatsApp skill: `.claude/skills/add-voice-transcription/SKILL.md`
- Discord.js Attachment docs: https://discord.js.org/#/docs/discord.js/main/class/Attachment
- OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
- Envoak integration: `/workspace/extra/envoak/`

---

**Good luck, Claude Code! This will make nanoclaw much more accessible.** 🎙️🌵
