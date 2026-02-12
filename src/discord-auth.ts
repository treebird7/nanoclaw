/**
 * Discord Bot Token Validation Script
 *
 * Validates the DISCORD_BOT_TOKEN by making a test API call.
 *
 * Usage: npx tsx src/discord-auth.ts
 */

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('✗ DISCORD_BOT_TOKEN environment variable is not set.');
  console.error('  Set it in your .env file or environment.');
  process.exit(1);
}

async function validate(): Promise<void> {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` },
  });

  if (res.ok) {
    const data = (await res.json()) as { username: string; id: string };
    console.log(`✓ Authenticated as ${data.username} (${data.id})`);
  } else {
    console.error(`✗ Authentication failed (HTTP ${res.status})`);
    console.error('  Check your DISCORD_BOT_TOKEN.');
    process.exit(1);
  }
}

validate().catch((err) => {
  console.error('✗ Validation failed:', err.message);
  process.exit(1);
});
