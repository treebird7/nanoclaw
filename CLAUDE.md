# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

## Quick Context

Single Node.js process that connects to Discord, routes messages to Claude Agent SDK running in Docker containers. Each channel has isolated filesystem and memory.

**Multi-Agent Support:** Single codebase can run multiple agents (sansan, sasusan, etc.) with per-group trigger patterns (`@sansan`, `@sasusan`) in the same Discord channel. Each agent has isolated state via `groups/{name}/` directories.

**Secret Management:** Uses envoak encryption (config.enc + .envoak_key) for all secrets. See Setup section below.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main app: Discord connection, message routing, IPC |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/agent-browser.md` | Browser automation tool (available to all agents via Bash) |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |

## Secret Management

NanoClaw uses **envoak encryption** for all secrets (Discord bot token, Claude OAuth token). Never use plaintext `.env` files.

**Setup:**
```bash
# Store encryption key (already done if migrating)
echo "ENCRYPTION_KEY_HERE" > .envoak_key
chmod 600 .envoak_key

# Add secrets to encrypted storage
ENVOAK_KEY=$(cat .envoak_key) envoak push DISCORD_BOT_TOKEN="..."
ENVOAK_KEY=$(cat .envoak_key) envoak push CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."

# Run with envoak inject (package.json scripts already configured)
npm run dev   # Uses envoak inject automatically
npm run auth  # For Discord OAuth flow
```

**Files:**
- ✅ Commit: `config.enc` (encrypted secrets)
- ❌ Never commit: `.envoak_key`, `.env`
- See `.gitignore` for complete list

**CRITICAL:** Never hardcode secrets in package.json or any tracked files. See `docs/LESSONS_LEARNED.md` Pattern 1.

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev          # Run with hot reload (uses envoak inject)
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management:
```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

## Container Build Cache

Apple Container's buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild:

```bash
container builder stop && container builder rm && container builder start
./container/build.sh
```

Always verify after rebuild: `container run -i --rm --entrypoint wc nanoclaw-agent:latest -l /app/src/index.ts`
