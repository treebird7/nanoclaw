import OpenAI from 'openai';
import { Attachment } from 'discord.js';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

let openaiClient: OpenAI | null = null;

const ALLOWED_URL_PREFIXES = [
  'https://cdn.discordapp.com/',
  'https://media.discordapp.net/',
];

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
    if (!ALLOWED_URL_PREFIXES.some((p) => attachment.url.startsWith(p))) {
      logger.warn({ url: attachment.url }, 'Rejected non-Discord attachment URL');
      return null;
    }

    const response = await fetch(attachment.url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = (attachment.name?.split('.').pop() || 'ogg').replace(/[^a-zA-Z0-9]/g, '');
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

  let filePath: string | null = null;
  try {
    filePath = await downloadVoiceAttachment(attachment);
    if (!filePath) return null;

    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });

    logger.info({ text: transcription.text.slice(0, 50) }, 'Voice transcribed');
    return transcription.text;
  } catch (err) {
    logger.error({ err }, 'Voice transcription failed');
    return '[Voice Message - transcription failed]';
  } finally {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch { /* already gone */ }
    }
  }
}

/**
 * Check if message has voice/audio attachments
 */
export function hasVoiceAttachment(attachments: Attachment[]): boolean {
  return attachments.some(
    (att) =>
      att.contentType?.startsWith('audio/') ||
      ['ogg', 'mp3', 'm4a', 'wav', 'webm'].some((ext) => att.name?.endsWith(`.${ext}`)),
  );
}
