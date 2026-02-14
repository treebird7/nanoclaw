---
name: add-discord-voice-transcription
description: Add voice message transcription for Discord using OpenAI Whisper API. Automatically transcribes Discord voice attachments so the agent can read and respond to them.
disable-model-invocation: true
---

# Add Discord Voice Message Transcription

This skill adds automatic voice message transcription using OpenAI's Whisper API. When users send voice notes or audio attachments in Discord, they'll be transcribed and the agent can read and respond to the content.

**UX Note:** When asking the user questions, prefer using the `AskUserQuestion` tool instead of just outputting text. This integrates with Claude's built-in question/answer system for a better experience.

## Prerequisites

**USER ACTION REQUIRED**

**Use the AskUserQuestion tool** to present this:

> You'll need an OpenAI API key for Whisper transcription.
>
> Get one at: https://platform.openai.com/api-keys
>
> Cost: ~$0.006 per minute of audio (~$0.003 per typical 30-second voice note)
>
> Once you have your API key, we'll configure it as an environment variable.

Wait for user to confirm they have an API key before continuing.

---

## Implementation

### Step 1: Add OpenAI Dependency

Read `package.json` and add the `openai` package to dependencies:

```json
"dependencies": {
  ...existing dependencies...
  "openai": "^4.77.0"
}
```

Then install it. **IMPORTANT:** The OpenAI SDK requires Zod v3 as an optional peer dependency, but NanoClaw uses Zod v4. This conflict is guaranteed, so always use `--legacy-peer-deps`:

```bash
npm install --legacy-peer-deps
```

### Step 2: Create Transcription Module

Create `src/transcription.ts`:

```typescript
import OpenAI from 'openai';
import { Attachment } from 'discord.js';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

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
    const ext = attachment.name?.split('.').pop() || 'ogg';
    const tempPath = path.join('/tmp', `voice-${Date.now()}.${ext}`);

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
 * Check if message has voice/audio attachments
 */
export function hasVoiceAttachment(attachments: Attachment[]): boolean {
  return attachments.some(att =>
    att.contentType?.startsWith('audio/') ||
    ['ogg', 'mp3', 'm4a', 'wav', 'webm'].some(ext => att.name?.endsWith(`.${ext}`))
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
      ['ogg', 'mp3', 'm4a', 'wav', 'webm'].some(ext => att.name?.endsWith(`.${ext}`))
    );

    if (voiceAttachment) {
      const transcript = await transcribeVoiceMessage(voiceAttachment);
      if (transcript) {
        content = `[Voice: ${transcript}]`;
        logger.info({ transcript: transcript.slice(0, 50) }, 'Voice message transcribed');
      }
    }
  }

  // ... rest of message processing using `content` variable ...
});
```

### Step 4: Update Database to Handle Transcribed Content

Read `src/db.ts` and find the `storeMessage` function. Update its signature and implementation to accept transcribed content:

Change the function signature to include an optional `transcribedContent` parameter:

```typescript
export function storeMessage(msg: Message, channelId: string, isFromMe: boolean, authorName?: string, transcribedContent?: string): void
```

Update the content extraction to use transcribed content if provided:

```typescript
const content = transcribedContent || msg.content || '';
```

### Step 5: Set Up API Key

The `OPENAI_API_KEY` must be available as an environment variable.

Add it to the service's environment (e.g., LaunchAgent plist, `.env`, or shell profile):

```bash
export OPENAI_API_KEY="sk-proj-..."
```

**Use the AskUserQuestion tool** to confirm:

> Please set the `OPENAI_API_KEY` environment variable in your service configuration.
>
> This can be in your LaunchAgent plist, `.env` file, or shell profile.
>
> Let me know when it's set.

### Step 6: Fix Orphan Container Cleanup (CRITICAL)

**This step is essential.** When the NanoClaw service restarts (e.g., `launchctl kickstart -k`), the running container is detached but NOT killed. The new service instance spawns a fresh container, but the orphan keeps running and shares the same IPC mount directory. Both containers race to read IPC input files, causing the new container to randomly miss messages -- making it appear like the agent doesn't respond.

The existing cleanup code in `ensureContainerSystemRunning()` in `src/index.ts` uses `container ls --format {{.Names}}` which **silently fails** on Apple Container (only `json` and `table` are valid format options). The catch block swallows the error, so orphans are never cleaned up.

Find the orphan cleanup block in `ensureContainerSystemRunning()` (the section starting with `// Kill and clean up orphaned NanoClaw containers from previous runs`) and replace it with:

```typescript
  // Kill and clean up orphaned NanoClaw containers from previous runs
  try {
    const listJson = execSync('container ls -a --format json', {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    const containers = JSON.parse(listJson) as Array<{ configuration: { id: string }; status: string }>;
    const nanoclawContainers = containers.filter(
      (c) => c.configuration.id.startsWith('nanoclaw-'),
    );
    const running = nanoclawContainers
      .filter((c) => c.status === 'running')
      .map((c) => c.configuration.id);
    if (running.length > 0) {
      execSync(`container stop ${running.join(' ')}`, { stdio: 'pipe' });
      logger.info({ count: running.length }, 'Stopped orphaned containers');
    }
    const allNames = nanoclawContainers.map((c) => c.configuration.id);
    if (allNames.length > 0) {
      execSync(`container rm ${allNames.join(' ')}`, { stdio: 'pipe' });
      logger.info({ count: allNames.length }, 'Cleaned up stopped containers');
    }
  } catch {
    // No containers or cleanup not supported
  }
```

### Step 7: Build and Restart

```bash
npm run build
```

Before restarting the service, kill any orphaned containers manually to ensure a clean slate:

```bash
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
nc = [c['configuration']['id'] for c in data if c['configuration']['id'].startswith('nanoclaw-')]
if nc: print(' '.join(nc))
" | xargs -r container stop 2>/dev/null
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
nc = [c['configuration']['id'] for c in data if c['configuration']['id'].startswith('nanoclaw-')]
if nc: print(' '.join(nc))
" | xargs -r container rm 2>/dev/null
echo "Orphaned containers cleaned"
```

Now restart the service:

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Verify it started with exactly one (or zero, before first message) nanoclaw container:

```bash
sleep 3 && launchctl list | grep nanoclaw
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
nc = [c for c in data if c['configuration']['id'].startswith('nanoclaw-')]
print(f'{len(nc)} nanoclaw container(s)')
for c in nc: print(f'  {c[\"configuration\"][\"id\"]} - {c[\"status\"]}')
"
```

### Step 8: Test Voice Transcription

Tell the user:

> Voice transcription is ready! Test it by:
>
> 1. Open Discord
> 2. Go to a registered channel
> 3. Send a voice message or attach an audio file (.ogg, .mp3, .m4a, .wav)
> 4. The agent should receive the transcribed text and respond
>
> In the database and agent context, voice messages appear as:
> `[Voice: <transcribed text here>]`

Watch for transcription in the logs:

```bash
tail -f logs/nanoclaw.log | grep -i "voice\|transcri"
```

---

## Configuration Options

### Enable/Disable Transcription

To disable transcription, simply unset `OPENAI_API_KEY` from the environment. The module will log a warning and fall back to `[Voice Message - transcription unavailable]`.

### Graceful Fallback Behavior

| Scenario | Result |
|----------|--------|
| `OPENAI_API_KEY` not set | `[Voice Message - transcription unavailable]` |
| API call fails | `[Voice Message - transcription failed]` |
| Download fails | Message skipped (no crash) |
| Everything works | `[Voice: <transcript>]` |

### Switch to Different Provider (Future)

The architecture supports multiple providers. To add Groq, Deepgram, or local Whisper:

1. Add a new transcribe function to `src/transcription.ts`
2. Add provider selection logic (env var or config)

---

## Troubleshooting

### Agent doesn't respond to voice messages (or any messages after restart)

**Most likely cause: orphaned containers.** When the service restarts, the previous container keeps running and races to consume IPC messages. Check:

```bash
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
nc = [c for c in data if c['configuration']['id'].startswith('nanoclaw-')]
print(f'{len(nc)} nanoclaw container(s):')
for c in nc: print(f'  {c[\"configuration\"][\"id\"]} - {c[\"status\"]}')
"
```

If you see more than one running container, kill the orphans:

```bash
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
running = [c['configuration']['id'] for c in data if c['configuration']['id'].startswith('nanoclaw-') and c['status'] == 'running']
if running: print(' '.join(running))
" | xargs -r container stop 2>/dev/null
container ls -a --format json | python3 -c "
import sys, json
data = json.load(sys.stdin)
nc = [c['configuration']['id'] for c in data if c['configuration']['id'].startswith('nanoclaw-')]
if nc: print(' '.join(nc))
" | xargs -r container rm 2>/dev/null
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

**Root cause:** The `ensureContainerSystemRunning()` function previously used `container ls --format {{.Names}}` which silently fails on Apple Container (only `json` and `table` formats are supported). Step 6 of this skill fixes this. If you haven't applied Step 6, the orphan problem will recur on every restart.

### "Transcription unavailable"

- `OPENAI_API_KEY` not set in environment
- Environment variable not reaching the process (check LaunchAgent plist or `.env`)

### "Transcription failed"

Check logs for specific errors:
```bash
tail -100 logs/nanoclaw.log | grep -i transcription
```

Common causes:
- API key invalid or expired
- No API credits remaining
- Network connectivity issues
- Audio format not supported by Whisper

### Voice messages not being detected

- Ensure the attachment has an audio content type or audio file extension (.ogg, .mp3, .m4a, .wav, .webm)
- Discord voice messages typically have `contentType: 'audio/ogg'`

### Dependency conflicts (Zod versions)

The OpenAI SDK requires Zod v3, but NanoClaw uses Zod v4. This conflict is guaranteed -- always use:
```bash
npm install --legacy-peer-deps
```

---

## Security Notes

- The `OPENAI_API_KEY` should be set as an environment variable -- never committed to git
- Audio files are sent to OpenAI for transcription -- review their data usage policy
- Temp files in `/tmp/` are deleted immediately after transcription
- Transcripts are stored in the SQLite database like regular text messages

---

## Cost Management

Monitor usage in your OpenAI dashboard: https://platform.openai.com/usage

Tips to control costs:
- Set spending limits in OpenAI account settings
- Remove `OPENAI_API_KEY` from environment to disable during development
- Typical usage: 100 voice notes/month (~3 minutes average) = ~$1.80

---

## Removing Voice Transcription

To remove the feature:

1. Remove from `package.json`:
   ```bash
   npm uninstall openai
   ```

2. Delete `src/transcription.ts`

3. Revert changes in `src/discord.ts`:
   - Remove the transcription imports
   - Remove `initTranscription()` call
   - Remove voice attachment handling block

4. Revert changes in `src/db.ts`:
   - Remove the `transcribedContent` parameter from `storeMessage`

5. Rebuild:
   ```bash
   npm run build
   launchctl kickstart -k gui/$(id -u)/com.nanoclaw
   ```

---

## Key Differences from WhatsApp Version

| Aspect | WhatsApp (Baileys) | Discord (Discord.js) |
|--------|-------------------|---------------------|
| Voice detection | `audioMessage.ptt === true` | `contentType.startsWith('audio/')` or file extension |
| Download method | `downloadMediaMessage(msg, 'buffer')` | `fetch(attachment.url)` |
| API key storage | `.transcription.config.json` (gitignored) | `OPENAI_API_KEY` environment variable |
| Message handler | `src/index.ts` sock.ev messages.upsert | `src/discord.ts` client.on messageCreate |
| Stored format | `[Voice: <transcript>]` | `[Voice: <transcript>]` |

---

## Future Enhancements

Potential additions:
- **Local Whisper**: Use `whisper.cpp` or `faster-whisper` for offline transcription
- **Groq Integration**: Free tier with Whisper, very fast
- **Deepgram**: Alternative cloud provider
- **Language Detection**: Auto-detect and transcribe non-English voice notes
- **Cost Tracking**: Log transcription costs per message
- **Speaker Diarization**: Identify different speakers in voice notes
