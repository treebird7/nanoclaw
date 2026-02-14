/**
 * Daily Digest Generator
 * Scans collab files for TLDR sections and generates morning briefings
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

interface TLDREntry {
  timestamp: string;
  title: string;
  description: string;
  hashtags: string[];
  wikilink?: string;
  agentName?: string;
  source: string;
}

interface DigestData {
  date: string;
  entries: TLDREntry[];
}

/**
 * Parse a single TLDR line into structured data
 * Format: `17:00` **Container hardening** — Debian→Alpine, 144→39 CVEs #docker #security → [[2026-02-12-daily#container-security]]
 */
function parseTLDRLine(line: string, source: string): TLDREntry | null {
  // Match the TLDR format with regex - wikilink is optional
  const match = line.match(/^-\s*`([^`]+)`\s*\*\*([^*]+)\*\*\s*—\s*(.+?)(?:\s*→\s*\[\[([^\]]+)\]\])?\s*$/);

  if (!match) return null;

  const [, timestamp, title, descriptionWithTags, wikilink] = match;

  // Extract hashtags from description
  const hashtags: string[] = [];
  const description = descriptionWithTags.replace(/#(\w+)/g, (_, tag) => {
    hashtags.push(tag);
    return `#${tag}`;
  }).trim();

  return {
    timestamp,
    title: title.trim(),
    description,
    hashtags,
    wikilink,
    source,
  };
}

/**
 * Extract TLDR section from a collab markdown file
 */
function extractTLDRSection(filePath: string): TLDREntry[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inTLDRSection = false;
  const entries: TLDREntry[] = [];

  for (const line of lines) {
    // Detect TLDR section start
    if (line.trim() === '## TLDR') {
      inTLDRSection = true;
      continue;
    }

    // Detect section end (next ## heading or empty line after entries)
    if (inTLDRSection && line.trim().startsWith('##')) {
      break;
    }

    // Parse TLDR entries
    if (inTLDRSection && line.trim().startsWith('-')) {
      const entry = parseTLDRLine(line, path.basename(filePath));
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Scan all collab directories for yesterday's TLDR sections
 */
export function collectYesterdayTLDRs(collabPaths: string[]): DigestData {
  const yesterday = getYesterdayDate();
  const allEntries: TLDREntry[] = [];

  for (const basePath of collabPaths) {
    const dailyPath = path.join(basePath, `${yesterday}-daily.md`);

    if (!fs.existsSync(dailyPath)) {
      logger.debug({ dailyPath }, 'Daily collab file not found');
      continue;
    }

    const entries = extractTLDRSection(dailyPath);

    // Add agent name from path (e.g., /toak/collab/ → toak)
    const agentName = basePath.split(path.sep).find(p => p !== 'collab' && p !== 'daily') || 'unknown';
    entries.forEach(entry => {
      entry.agentName = agentName;
    });

    allEntries.push(...entries);

    logger.debug({ dailyPath, entryCount: entries.length }, 'Extracted TLDR entries');
  }

  return {
    date: yesterday,
    entries: allEntries,
  };
}

/**
 * Group entries by category based on hashtags
 */
function categorizeEntries(entries: TLDREntry[]): Record<string, TLDREntry[]> {
  const categories: Record<string, TLDREntry[]> = {
    security: [],
    content: [],
    integration: [],
    bugfix: [],
    feature: [],
    other: [],
  };

  const categoryTags: Record<string, string> = {
    security: 'security',
    content: 'content',
    integration: 'integration',
    bugfix: 'bugfix',
    feature: 'feature',
  };

  for (const entry of entries) {
    let categorized = false;

    for (const [category, tag] of Object.entries(categoryTags)) {
      if (entry.hashtags.includes(tag)) {
        categories[category].push(entry);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.other.push(entry);
    }
  }

  // Remove empty categories
  Object.keys(categories).forEach(key => {
    if (categories[key].length === 0) {
      delete categories[key];
    }
  });

  return categories;
}

/**
 * Generate a formatted Discord digest message
 */
export function generateDigestMessage(data: DigestData): string {
  const { date, entries } = data;

  if (entries.length === 0) {
    return `🌅 **Daily Flock Digest — ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}**\n\n_No TLDR entries found for yesterday. The flock was quiet!_ 🌵`;
  }

  const categorized = categorizeEntries(entries);
  const emojiMap: Record<string, string> = {
    security: '🔒',
    content: '🎙️',
    integration: '🔌',
    bugfix: '🐛',
    feature: '✨',
    other: '📝',
  };

  let message = `🌅 **Daily Flock Digest — ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}**\n\n`;
  message += `**Yesterday's Highlights** (${entries.length} activities):\n\n`;

  for (const [category, categoryEntries] of Object.entries(categorized)) {
    const emoji = emojiMap[category] || '📝';

    for (const entry of categoryEntries) {
      const agentLabel = entry.agentName ? ` [${entry.agentName}]` : '';
      message += `${emoji} **${entry.title}** (${entry.timestamp})${agentLabel} — ${entry.description}\n`;
    }
  }

  message += `\n_Full details in collab logs_`;
  message += `\n\n<!-- generated:nanoclaw:sansan-digest | updated:${new Date().toISOString()} -->`;

  return message;
}

/**
 * Main digest generation function
 */
export async function generateDailyDigest(collabPaths: string[]): Promise<string> {
  logger.info('Generating daily digest from TLDR sections');

  const data = collectYesterdayTLDRs(collabPaths);

  logger.info({
    date: data.date,
    entryCount: data.entries.length,
    agents: [...new Set(data.entries.map(e => e.agentName))],
  }, 'Collected TLDR entries');

  const message = generateDigestMessage(data);

  return message;
}
