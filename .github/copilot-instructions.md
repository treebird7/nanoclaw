# NanoClaw — Copilot Instructions

> **Quick start:** `CLAUDE.md` has the full architecture, key files, and container build patterns. Read it first.

NanoClaw is a **personal WhatsApp AI assistant**. Single Node.js process: WhatsApp via Baileys → routes messages to Claude Agent SDK running in Apple Container (isolated Linux VMs per group).

## Build, Test, Lint

```bash
npm run build          # tsc → dist/
npm test               # vitest run
npm run dev            # tsx with hot reload (no build needed)

# Container (Apple Container — macOS only)
./container/build.sh   # Build agent container image
container builder stop && container builder rm && container builder start && ./container/build.sh  # Clean rebuild (invalidates cache)
```

## Architecture

| File | Role |
|------|------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection via Baileys, auth, send/receive |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Cron-based scheduled tasks |
| `src/db.ts` | SQLite operations |
| `src/config.ts` | Trigger pattern, paths, intervals |

### Group isolation
Each group in `groups/{name}/` gets an isolated container filesystem and memory. `CLAUDE.md` in each group dir = per-group agent identity/instructions.

### Container build cache
Apple Container's buildkit aggressively caches. `--no-cache` alone does NOT invalidate COPY steps. For truly clean rebuild, stop and remove the builder volume first (see build command above).

## Conventions

- **Node.js >= 20** required
- **All imports use `.js` extensions** in `.ts` source files (NodeNext resolution)
- **Secrets**: inject via `envoak inject`, never hardcode
- **Service management**: launchd via `~/Library/LaunchAgents/com.nanoclaw.plist`
- Tests use `vitest` with `describe`/`it`/`expect`

```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

## Integration Points

- **WhatsApp**: Baileys library (open-source WhatsApp Web API)
- **Claude Agent SDK**: Anthropic SDK inside the container — requires `ANTHROPIC_API_KEY`
- **SQLite** (`src/db.ts`): local state persistence, no Supabase dependency
- **Container agent browser skill**: `container/skills/agent-browser.md` — available to all agents via Bash
