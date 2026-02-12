import { Client, Events, GatewayIntentBits, TextChannel, DMChannel, ChannelType, Partials } from 'discord.js';
import { logger } from './logger.js';

export interface DiscordMessage {
  channelId: string;
  content: string;
  authorName: string;
  messageId: string;
  isBot: boolean;
  timestamp: string;
}

export interface DiscordGuildInfo {
  guildId: string;
  guildName: string;
  channels: Array<{ id: string; name: string }>;
}

let client: Client;

export async function connectDiscord(
  token: string,
  onMessage: (msg: DiscordMessage) => void,
  onReady: () => void,
): Promise<void> {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.on(Events.MessageCreate, (message) => {
    logger.debug({
      channelId: message.channelId,
      author: message.author.username,
      content: message.content.slice(0, 50),
      isBot: message.author.bot
    }, 'Discord message received');

    onMessage({
      channelId: message.channelId,
      content: message.content,
      authorName: message.author.displayName || message.author.username,
      messageId: message.id,
      isBot: message.author.bot,
      timestamp: message.createdAt.toISOString(),
    });
  });

  client.on(Events.ClientReady, () => {
    logger.info({ user: client.user?.tag }, 'Connected to Discord');
    onReady();
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, 'Discord client error');
  });

  await client.login(token);
}

export async function sendDiscordMessage(channelId: string, text: string): Promise<void> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel || channel instanceof DMChannel)) {
    logger.warn({ channelId }, 'Cannot send to channel — not a text channel');
    return;
  }

  // Discord max message length is 2000 chars — split if needed
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 2000) {
      chunks.push(remaining);
      break;
    }
    // Try to split at last newline before 2000
    let splitAt = remaining.lastIndexOf('\n', 2000);
    if (splitAt <= 0) splitAt = 2000;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  for (const chunk of chunks) {
    await channel.send(chunk);
  }
  logger.info({ channelId, length: text.length }, 'Message sent');
}

export async function setDiscordTyping(channelId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && (channel instanceof TextChannel || channel instanceof DMChannel)) {
      await channel.sendTyping();
    }
  } catch (err) {
    logger.debug({ channelId, err }, 'Failed to send typing indicator');
  }
}

export function getDiscordGuilds(): DiscordGuildInfo[] {
  if (!client) return [];
  return Array.from(client.guilds.cache.values()).map((guild) => ({
    guildId: guild.id,
    guildName: guild.name,
    channels: Array.from(guild.channels.cache.values())
      .filter((ch) => ch.type === ChannelType.GuildText)
      .map((ch) => ({ id: ch.id, name: ch.name })),
  }));
}

export function stopDiscord(): void {
  if (client) client.destroy();
}
