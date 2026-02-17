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
    const filePath = await downloadVoiceAttachment(attachment);
    if (!filePath) return null;

    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });

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
  return attachments.some(
    (att) =>
      att.contentType?.startsWith('audio/') ||
      ['ogg', 'mp3', 'm4a', 'wav', 'webm'].some((ext) => att.name?.endsWith(`.${ext}`)),
  );
}
