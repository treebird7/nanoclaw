# Knowledge Search Skill

## Purpose

Discover knowledge across the entire Treebird flock. Search past solutions, find relevant context, and prevent duplicate work.

## When to Use

- User asks about something that might have been solved before
- Looking for examples of how something was implemented
- Need to understand patterns used across the flock
- Want to see if another agent has expertise in a topic

## Available Tools

### 1. Watsan Semantic Search

Use `mcp__watsan__search_knowledge` to search the knowledge base:

```typescript
// Search for relevant documentation
const results = await mcp__watsan__search_knowledge({
  query: "how to handle API rate limiting",
  limit: 5,
  threshold: 0.35
});
```

### 2. Grep Across Flock Directories

Search code and documentation across mounted flock agents:

```bash
# Search for specific patterns in code
grep -r "exponential backoff" /workspace/extra/*/src/

# Search collab logs for past discussions
grep -r "authentication" /workspace/extra/*/collab/

# Search for error handling patterns
grep -r "try.*catch" /workspace/extra/*/src/ | head -20
```

### 3. File Discovery with Glob

Find files by name pattern:

```bash
# Find all rate limiting implementations
find /workspace/extra -name "*rate*limit*" -type f

# Find all authentication modules
find /workspace/extra -name "*auth*" -type f
```

### 4. Watsan Knowledge Graph

Query entity relationships:

```typescript
// Search for entities related to a topic
const nodes = await mcp__watsan__kg_search_nodes({
  query: "authentication",
  limit: 10
});

// Get neighbors of a specific entity
const neighbors = await mcp__watsan__kg_get_neighbors({
  entity_name: "mycm"
});
```

## Search Workflow

### Step 1: Start with Semantic Search

Always try Watsan first - it's indexed and fast:

```typescript
const results = await mcp__watsan__search_knowledge({
  query: "YOUR_QUESTION_HERE",
  limit: 5
});

if (results.documents && results.documents.length > 0) {
  // Found relevant docs!
  // Present the findings to the user
}
```

### Step 2: If No Results, Search Collab Logs

```bash
# Search recent daily collabs
grep -r "YOUR_KEYWORD" /workspace/extra/*/collab/daily/ | tail -20
```

### Step 3: If Still No Results, Search Code

```bash
# Search for implementation patterns
grep -r "YOUR_PATTERN" /workspace/extra/*/src/ | head -20
```

### Step 4: Check Knowledge Graph

```typescript
// Find related agents or concepts
const nodes = await mcp__watsan__kg_search_nodes({
  query: "YOUR_CONCEPT",
  limit: 10
});
```

## Example Searches

### "How do we handle database migrations?"

```typescript
// 1. Semantic search
const results = await mcp__watsan__search_knowledge({
  query: "database migrations schema changes",
  limit: 5
});

// 2. Grep for migration files
// grep -r "migrate" /workspace/extra/*/src/

// 3. Find migration scripts
// find /workspace/extra -name "*migration*" -type f
```

### "Who has implemented OAuth before?"

```typescript
// 1. Knowledge graph search
const nodes = await mcp__watsan__kg_search_nodes({
  query: "OAuth authentication",
  limit: 10
});

// 2. Grep code
// grep -r "OAuth" /workspace/extra/*/src/

// 3. Check collab logs
// grep -r "OAuth" /workspace/extra/*/collab/
```

### "What error handling patterns do we use?"

```bash
# Find try-catch patterns
grep -rn "try {" /workspace/extra/*/src/ | head -20

# Find error classes
grep -rn "class.*Error" /workspace/extra/*/src/

# Check for error logging
grep -rn "logger.error" /workspace/extra/*/src/ | head -20
```

## Response Format

When you find knowledge, format it clearly:

```markdown
**Found Solution**: [Agent] implemented this in [file/location]

**Key Points**:
- Point 1
- Point 2

**Code Example**:
[Show relevant snippet]

**Source**: /workspace/extra/[agent]/[path]
```

## Agent Recommendations

If you find that a specific agent has expertise, recommend coordination:

```markdown
**Agent with Expertise**: [Agent Name] has worked on similar problems

**Evidence**:
- Found implementation in /workspace/extra/[agent]/[file]
- Collab logs show they solved [similar problem] on [date]

**Recommendation**: Use TOAK to message [agent] for guidance:
```

## Tips

- **Start broad, then narrow**: Begin with semantic search, drill down if needed
- **Multiple search terms**: Try variations of your query
- **Check recent work**: Recent collab logs often have fresh solutions
- **Follow the hashtags**: Collab entries with #tags are easier to find
- **Don't reinvent**: If someone solved it, learn from their approach

## Limitations

- Watsan semantic search may hit OpenAI quota (fallback to grep)
- Not all agents have collab logs mounted
- Some solutions may be in private repos (not accessible)
- Knowledge graph is still growing (17 entities as of 2026-02-13)

## Integration with Watsan Oracle

For complex questions, use the Oracle:

```typescript
const answer = await mcp__watsan__oracle_query({
  question: "YOUR_COMPLEX_QUESTION",
  context: "Additional context if helpful"
});

// Oracle synthesizes answers from knowledge base + returns relevant docs
```

## Success Metrics

- ✅ User question answered from past solutions
- ✅ Duplicate work prevented
- ✅ Cross-agent collaboration enabled
- ✅ Knowledge reuse increased

## Future Enhancements

- Auto-indexing of new collab entries
- Real-time knowledge graph updates
- Agent skill/expertise tagging
- Automatic similarity detection for new problems
