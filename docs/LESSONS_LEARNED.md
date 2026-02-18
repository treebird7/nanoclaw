# 🎓 Lessons Learned

> NanoClaw-specific patterns learned from debugging and development sessions.
> Updated via `/reflect` workflow.

---

## Secret Management

### Lesson 1: NEVER Hardcode Secrets in Tracked Files
**Discovered:** 2026-02-15
**Source:** Envoak integration - hardcoded ENVOAK_KEY in package.json
**Confidence:** HIGH
**Severity:** 🚨 CRITICAL

**Anti-pattern:**
```json
{
  "scripts": {
    "dev": "ENVOAK_KEY=2be3558876867783f083900db4d1e4e21e63756e6235705cbdffa35a576a8150 node ..."
  }
}
```

**Correct pattern:**
```json
{
  "scripts": {
    "dev": "ENVOAK_KEY=$(cat .envoak_key) node ..."
  }
}
```

**Rules:**
1. Store secrets in gitignored files (`.envoak_key`, `.env`)
2. Read secrets at runtime using shell substitution `$(cat file)`
3. Add secret files to `.gitignore` IMMEDIATELY
4. Never commit files containing:
   - ENVOAK_KEY
   - Discord bot tokens
   - Claude OAuth tokens
   - API keys
   - Any credential

**Verification:**
```bash
# Check if secret exists in git history
git log -p --all -S "ENVOAK_KEY"

# Check current gitignore
grep -E "(envoak_key|\.env)" .gitignore
```

**Impact:** Hardcoded secrets in package.json would expose them to:
- Git commits and history
- GitHub repositories (if pushed)
- Code sharing (collab mentions, screenshots)
- Security scanning bots

---

## Container Environment

### Lesson 2: Envoak Inject Uses process.env, Not Container Env
**Discovered:** 2026-02-15
**Source:** Authentication failure - "Not logged in" after envoak integration
**Confidence:** HIGH

**Problem:**
When using `envoak inject node app.js`:
- Secrets are injected into **main process** `process.env`
- Child processes (Docker containers) do NOT inherit these automatically
- Container code that only reads `.env` files will fail

**Root cause:**
```typescript
// ❌ Only reads from .env file (won't see envoak inject vars)
const envFile = path.join(projectRoot, '.env');
const envContent = fs.readFileSync(envFile, 'utf-8');
```

**Solution:**
```typescript
// ✅ Check process.env FIRST, then fall back to .env file
const allowedVars = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];
const filteredLines: string[] = [];

// First, try to read from process.env (for envoak inject)
for (const varName of allowedVars) {
  if (process.env[varName]) {
    filteredLines.push(`${varName}=${process.env[varName]}`);
  }
}

// If not found in process.env, try reading from .env file
if (filteredLines.length === 0) {
  const envFile = path.join(projectRoot, '.env');
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    // ... read from file
  }
}
```

**Applied in:** `src/container-runner.ts` lines 170-194

**Debugging symptoms:**
- Agent SDK shows "Not logged in · Please run /login"
- Refreshing OAuth token doesn't help
- Clearing session storage doesn't help
- `docker inspect` shows container has no env vars
- Main process has vars, container doesn't

---

### Lesson 3: Container Environment Isolation
**Discovered:** 2026-02-15
**Source:** Debugging envoak authentication failure
**Confidence:** HIGH

**Key insight:** Main Node.js process environment ≠ Docker container environment

**Isolation layers:**
1. **Shell environment** → `npm run dev`
2. **Envoak inject** → Wraps Node.js process with decrypted secrets
3. **Main Node.js process** → Has `process.env.CLAUDE_CODE_OAUTH_TOKEN`
4. **Docker container** → Separate process, needs explicit passing

**Environment variables do NOT:**
- Automatically propagate to Docker containers
- Inherit from parent process by default
- Get mounted into container filesystem

**Environment variables DO need:**
- Explicit `-e VAR=value` in docker run
- Mount as files via `-v /host/env:/container/env`
- Reading from process.env and writing to mount point

**NanoClaw implementation:**
```typescript
// Write auth vars from process.env to container mount
const envDir = path.join(DATA_DIR, 'env');
fs.mkdirSync(envDir, { recursive: true });
fs.writeFileSync(
  path.join(envDir, 'env'),
  filteredLines.join('\n') + '\n'
);

// Mount the env directory into container
mounts.push({
  hostPath: envDir,
  containerPath: '/workspace/env-dir',
  readonly: true,
});
```

**Debugging checklist:**
1. ✅ Verify var exists in main process: `console.log(process.env.VAR)`
2. ✅ Verify var written to mount: `cat data/env/env`
3. ✅ Verify mount exists in container: `docker inspect <container>`
4. ✅ Verify var accessible in container: `docker exec <container> cat /workspace/env-dir/env`

---

## Architecture

### Lesson 4: Single Codebase > Multiple Deployments
**Discovered:** 2026-02-15
**Source:** Multi-agent channel setup (sansan + sasusan)
**Confidence:** MEDIUM

**Preference:** Use single nanoclaw codebase with per-group configuration rather than separate nanoclaw instances for each agent.

**Benefits:**
- Simpler maintenance (one codebase, one deployment)
- Shared infrastructure (Discord client, database, container system)
- Easier coordination between agents (same IPC system)
- Centralized logging and monitoring
- Lower resource usage (one Node.js process vs multiple)

**Implementation:**
- Store agent identity in `groups/{name}/CLAUDE.md`
- Use per-group trigger patterns (`@sansan`, `@sasusan`)
- Isolate group state in database and filesystem

**When to use separate instances:**
- Different hosting environments (local vs VPS)
- Different security contexts (production vs dev)
- Completely different platforms (Discord vs Telegram)

---

## Setup & Configuration

### Lesson 5: Envoak as Standard for NanoClaw Secrets
**Discovered:** 2026-02-15
**Source:** Migration from .env to envoak encryption
**Confidence:** MEDIUM → HIGH

**Pattern:** Use envoak encryption for all nanoclaw secrets, not plaintext `.env` files.

**Setup:**
```bash
# Initialize envoak
envoak init

# Add secrets
envoak push DISCORD_BOT_TOKEN="..."
envoak push CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."

# Store encryption key securely
echo "ENVOAK_KEY_HERE" > .envoak_key
chmod 600 .envoak_key
echo ".envoak_key" >> .gitignore

# Update package.json scripts
{
  "dev": "ENVOAK_KEY=$(cat .envoak_key) node /path/to/envoak inject tsx src/index.ts",
  "auth": "ENVOAK_KEY=$(cat .envoak_key) node /path/to/envoak inject tsx src/discord-auth.ts"
}
```

**Benefits:**
- Encrypted secrets can be committed (config.enc)
- No plaintext secrets on disk
- Cross-machine sync safe
- Centralized secret management
- Works with container environment (see Lesson 2)

**Files:**
- ✅ Commit: `config.enc` (encrypted)
- ❌ Never commit: `.envoak_key`, `.env`
- ✅ Add to .gitignore: `.envoak_key`, `.env`

---

### Lesson 6: `.mcp.json` Must Be Gitignored Before First Commit
**Discovered:** 2026-02-18
**Source:** Security audit found TOAK_API_KEY and ENVOAK_KEY exposed in public GitHub repo
**Confidence:** HIGH
**Severity:** 🚨 CRITICAL

**Problem:**
`.mcp.json` contains plaintext MCP server credentials (API keys, encryption keys). It was committed in the very first commit and pushed to a public GitHub fork, exposing all secrets to the internet.

**Anti-pattern:**
```bash
# First commit includes .mcp.json with secrets
git add .
git commit -m "initial commit"  # .mcp.json is now in git history forever
```

**What was exposed:**
```json
{
  "mcpServers": {
    "toak": { "env": { "TOAK_API_KEY": "plaintext-key-here" } },
    "envoak": { "env": { "ENVOAK_KEY": "plaintext-key-here" } }
  }
}
```

**Correct pattern:**
```bash
# BEFORE the first commit
echo ".mcp.json" >> .gitignore
git add .gitignore
git commit -m "init: add gitignore with secret patterns"
# Now safe to create .mcp.json locally
```

**Recovery steps (what we did):**
1. `git rm --cached .mcp.json` — untrack without deleting local file
2. Add `.mcp.json` to `.gitignore`
3. Rotate ALL keys that were in the file (TOAK_API_KEY, ENVOAK_KEY)
4. Rotate ALL keys in `config.enc` too (DISCORD_BOT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, OPENAI_API_KEY) since ENVOAK_KEY was exposed
5. Update downstream services with new keys (hub, Railway)
6. Add `.mcp.json` to mount-allowlist blockedPatterns

**Rules:**
1. `.mcp.json` goes in `.gitignore` **before the first commit**, every time
2. Treat `.mcp.json` like `.env` — it contains secrets, never track it
3. If exposed: rotate every key in the file AND every key encrypted by any exposed encryption key
4. `git rm --cached` only removes from future commits — the key is still in git history
5. Add to mount-allowlist blockedPatterns so containers can't read it either

**Detection:**
```bash
# Check if .mcp.json is tracked
git ls-files .mcp.json

# Check if it was ever committed
git log --all --oneline -- .mcp.json
```

---

## Security Architecture

### Lesson 7: Layered Secret Protection — Belt + Suspenders
**Discovered:** 2026-02-18
**Source:** Cherry-picking upstream security commits while preserving envoak integration
**Confidence:** HIGH

**Problem:** Two independent security fixes for container secret leakage existed in parallel:
1. Fork's approach: pass secrets via `readSecrets()` → `input.secrets` → stdin JSON, never in process.env
2. Private branch: envoak-injected vars via env-dir mount into container filesystem

**Solution:** Keep both — they protect different attack surfaces:

```typescript
// container-runner.ts: env-dir mount (envoak path)
// Reads from process.env (envoak-injected) first, falls back to .env
// Written to /workspace/env-dir/env — container reads on startup

// Also: readSecrets() → input.secrets → stdin JSON
// Deleted from memory immediately after container reads it
input.secrets = readSecrets();
container.stdin.write(JSON.stringify(input));
container.stdin.end();
delete input.secrets; // never in logs
```

```typescript
// container/agent-runner/src/index.ts: sdkEnv (never touch process.env)
const sdkEnv: Record<string, string | undefined> = { ...process.env };
for (const [key, value] of Object.entries(containerInput.secrets || {})) {
  sdkEnv[key] = value; // secrets only in SDK call, not process.env
}
// + PreToolUse hook strips secrets from every Bash subprocess
```

**Why both:**
- env-dir mount = Apple Container workaround (stdin pipe needs explicit env file)
- sdkEnv = SDK-only secret scope (Bash subprocesses can't see API keys)
- PreToolUse hook = defense in depth (even if sdkEnv leaks, Bash unsets them)

---

### Lesson 8: PreToolUse Hook for Bash Secret Sanitization
**Discovered:** 2026-02-18
**Source:** `1a07869` — security: sanitize env vars from agent Bash subprocesses
**Confidence:** HIGH
**Severity:** 🔒 SECURITY

**Problem:** Agent Bash subprocesses could exfiltrate secrets via `env`, `printenv`, or `echo $VAR`.

**Solution:** Register a `PreToolUse` SDK hook that prepends `unset SECRET_VARS` to every Bash command:

```typescript
const SECRET_ENV_VARS = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'];

function createSanitizeBashHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const command = (preInput.tool_input as { command?: string })?.command;
    if (!command) return {};

    const unsetPrefix = `unset ${SECRET_ENV_VARS.join(' ')} 2>/dev/null; `;
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...(preInput.tool_input as Record<string, unknown>),
          command: unsetPrefix + command,
        },
      },
    };
  };
}

// Register in query options:
hooks: {
  PreCompact: [{ hooks: [createPreCompactHook()] }],
  PreToolUse: [{ matcher: 'Bash', hooks: [createSanitizeBashHook()] }],
}
```

**Impact:** Closes all known exfiltration vectors — `env`, `printenv`, `echo $ANTHROPIC_API_KEY` all return empty.

---

## Workflow

### Lesson 9: Use Spidersan Before Cherry-Picking From a Fork
**Discovered:** 2026-02-18
**Source:** Syncing `treebird7/nanoclaw` (public fork) → `treebird7/nanoclaw-private`
**Confidence:** HIGH

**Problem:** Naively merging a fork's commits can silently overwrite private-branch changes (e.g. Discord replacing WhatsApp).

**Spidersan workflow that prevented this:**

```bash
# 1. Init spidersan in the repo
spidersan init

# 2. Register private branch files
spidersan register --files "src/discord.ts,src/config.ts,..." \
  --agent nanoclaw-private -d "Discord migration"

# 3. Create local branch from fork, register it
git checkout -b fork-candidate fork/main
spidersan register --files "src/whatsapp.ts,src/config.ts,..." \
  --agent nanoclaw-fork -d "Upstream fork commits"

# 4. Run conflict detection
spidersan conflicts
# → 🔴 TIER 3 BLOCK: src/whatsapp-auth.ts
# → 🟠 PAUSE: package.json, src/config.ts, src/index.ts, src/container-runner.ts

# 5. Per-commit analysis instead of merge
git log --oneline private/main..fork/main
git diff --name-only <sha>^..<sha>   # per commit
# → Classify: SAFE / NEEDS-REVIEW / SKIP
```

**Key insight:** `spidersan conflicts` revealed the exact files at risk *before* touching anything. Without it, a `git merge fork/main` would have silently reintroduced WhatsApp code and broken the Discord integration.

**Skip criteria (from this session):**
- Fork commits that touch files where your branch has fundamentally replaced the implementation (WhatsApp → Discord)
- Large refactors (`2b56fec` Refactor index) that assume a different architecture
- CI workflows that test functionality you no longer have (WhatsApp tests)

---

*Last updated: 2026-02-18*
