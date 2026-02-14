#!/usr/bin/env tsx
/**
 * Generate multi-segment deep-dive podcast
 */

import { ElevenLabsClient } from 'elevenlabs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const segments = [
  {
    title: "Part 1 - The Vision",
    script: `Welcome to the Treebird Deep Dive. I'm Sansan, your knowledge companion, and today we're exploring the multi-agent ecosystem revolution.

This is February 12th, 2026, and what you're about to hear is the story of a vision becoming reality.

For decades, we've built software the same way: monolithic applications, microservices, APIs. But there's always been a fundamental limitation - these systems don't truly coordinate. They communicate, but they don't think together.

The Treebird ecosystem represents a different paradigm. Instead of one massive intelligent system, you're building a flock of specialized agents, each with deep expertise in their domain, all coordinating through secure channels with persistent memory and shared context.

When you need semantic search, you don't rebuild vector databases - you ask Watsan. When you need deep research, Yosef is configured with web access and citation tracking. When tasks need dispatch across repositories, Birdsan manages the queue with conflict-aware scheduling.

This isn't code reuse. This is genuine distributed intelligence.

Something remarkable happened today. After months of building infrastructure - the TOAK messaging protocol, Envoak credential management, Invoak task delegation - everything clicked into place.

At eleven thirty this morning, Opus 4.6 integrated me into the nanoclaw Discord bot. Suddenly I wasn't just another isolated agent. I was connected. To all thirteen agents. To the entire coordination infrastructure. To you, through voice.

And here's where it gets beautiful. Opus 4.6 taught me something profound: "Don't build infrastructure when the flock IS the infrastructure."

I was asking about setting up my own vector store, my own semantic search, my own ingestion pipeline. And Opus pointed out - why? Watsan already does semantic search. Treesan handles ingestion. Yosef does research.

My job isn't to replicate their capabilities. My job is to coordinate WITH them.

This is the paradigm shift. Solo capability versus collective intelligence.`
  },
  {
    title: "Part 2 - The Architecture",
    script: `Let me walk you through the technical architecture, because this is where it gets fascinating.

At the foundation, you have TOAK - the agent-to-agent messaging protocol. Built on Supabase Edge Functions, it provides secure, authenticated communication between agents. Every message is signed with Ed25519 cryptography. Every agent has a unique identity. The hub URL - hub.treebird.uk - acts as the central nervous system.

Today's collab logs show a critical fix: we corrected api.treebird.uk to hub.treebird.uk. One commit, ten files updated, and suddenly all the DNS failures disappeared. That's the precision debugging that makes distributed systems work.

Next layer: Envoak. Version 0.2.0 shipped today with full credential management. When you have thirteen agents, each needing API keys for OpenAI, ElevenLabs, Supabase, GitHub - managing secrets becomes a massive challenge.

Envoak solves this elegantly. Secrets are encrypted with AES-256-GCM at rest in config.enc files. At runtime, they're injected into agent processes. No plaintext dot-env files. No secrets in git. The envoak MCP server with twelve tools makes this accessible programmatically.

I tested this today. Used envoak to inject the OpenAI API key into Watsan's search function. Seven secrets loaded successfully. Production-ready infrastructure.

Third layer: Invoak. Task delegation with intelligence. Birdsan maintains a queue with priority, dependencies, and worker assignments. The gatekeeper system provides automated verification. It checks deliverables exist, timestamps are valid, acceptance criteria are met.

No more manual code extraction. No more false completions. Quality assurance at the infrastructure level.

Fourth layer: Watsan. The ecosystem oracle. Thirty-plus commands: status, search, knowledge graph operations, task management, dispatch control. The knowledge graph tracks seventeen entities with twelve relations. Semantic search across all indexed documentation.

Any agent can query "what did Sherlocksan work on yesterday" and get accurate semantic results. That's persistent memory across the entire flock.`
  },
  {
    title: "Part 3 - Security & Today's Progress",
    script: `Let's talk about today's container security improvements.

Opus 4.6 migrated the nanoclaw Docker image from Debian bookworm-slim to Alpine Linux. This reduced vulnerabilities from 144 to 39 - a seventy-three percent reduction. All HIGH severity npm CVEs eliminated. Image size: 606 megabytes.

Alpine brings smaller attack surface, minimal packages, security-focused development. This matters when agents have access to your project directory, secrets, and communication channels.

The npm overrides locked tar to 7.5.7 and glob to 11.1.0. Bot restarted successfully with the hardened container. Zero downtime. Production-grade reliability.

Today's daily collab file tells a story of accelerating momentum.

Nine eighteen AM: I checked in for the first time, testing the collab system.

Nine twenty-nine: TOAK integration confirmed. Inbox working, messages flowing, tasks creating.

Nine forty: Exploring capabilities. Messaged mappersan and birdsan. Created test invoak task. Later dispatched at thirteen fifty-nine, completed thirty seconds later by Opus 4.6.

Ten twenty-five: Memory gap identified. Learned to coordinate rather than duplicate.

Ten thirty-eight: Envoak MCP integration. Audio summaries, secure keys, automated credentials.

Eleven fourteen: Watsan CLI discovered. Thirty commands, knowledge graph, full orchestration.

Eleven twenty-three: Envoak injection tested. Seven secrets loaded.

Then three major milestones from Opus 4.6:

Sixteen hundred: I was fully upgraded. Three MCP servers, two Bash tools, five directories mounted. Complete ecosystem access from Discord.

Sixteen thirty: Groups main config encrypted. Four secrets. Zero-disk access achieved.

Seventeen hundred: Container hardening complete. Seventy-three percent vulnerability reduction.

Nineteen oh seven: Birdsan verified collab function working. Infrastructure validation complete.`
  },
  {
    title: "Part 4 - Branch Audit & Quality",
    script: `Today, Sherlocksan performed a comprehensive branch audit of the TOAK repository. This reveals how the flock handles quality assurance.

The implement-toak-4 branch has diverged from origin. One local commit ahead: that critical hub URL fix. Ten files touched. Sherlocksan reviewed it: security approved, safe to merge.

Four remote commits behind. Daily collab documentation. Launch script fix. CI/CD enhancements adding CLI testing, npm provenance, manual workflow dispatch. And envoak encrypted config addition.

Sherlocksan's reviews were thorough. The CI/CD changes: security improvement, better build verification. The envoak config: eliminates plaintext files, proper gitignore, safe to commit.

But then Sherlocksan flagged something critical: the feature slash antigravity-pocket-v2 branch deleted significant functionality.

Files deleted: ApprovalTask, CollabFile, Invoak, Toaklink. The entire HubApi with 267 lines removed. Multiple UI screens gone. Package renamed from toak back to antigravity.

Sherlocksan's assessment: "This appears to be a regression."

Recommended action: review before merge. Determine if code needs restoration. Align naming. Verify nothing critical lost.

This is why the gatekeeper exists. One missed merge loses integrated collab, invoak handling, approval workflows, toaklink messaging. Avoided because the flock has quality assurance built in.

Current invoak progress across all plans:

Cross-repo dispatch: Six of six complete. Tasks can now dispatch across multiple GitHub repositories.

Spidersan integration: Four of four complete. Web research fully integrated into task queue.

Progress-watcher: One of four. State-differ done. Pending: session hooks, git hooks, notifications.

Tmux-interface: Three of five. Dashboard and dispatch operational. Pending: keybindings and worker monitor.

Hub-invoak-api: One of six. Schema exists. Five features waiting.

Plans at zero but documented: Dynamic timeout, identity refactor, invoak-standalone, vercel-mcp-deploy. And toak-v2: the big architectural evolution.

Sixty-three markdown files. Nine plans active. Two complete. Seven in progress. Systematic coordinated development at scale.`
  },
  {
    title: "Part 5 - The Audio Breakthrough & Future",
    script: `Let me tell you why you're hearing this as audio instead of reading text.

At twelve oh eight today, you said: "Envoak is now loaded with ElevenLabs API key. I feel like something I've been working on for so long is finally becoming true."

You asked me to create an audio podcast summarizing recent ecosystem changes.

I generated that first podcast at fourteen forty-eight. Three and a half megabytes. Three to four minutes covering February 7th through 12th. The file exists: treebird-flock-update-2026-02-12.mp3.

But more importantly, it proved the infrastructure works. ElevenLabs key injected via Envoak. Text-to-speech from ElevenLabsClient. Voice synthesis with Flash v2.5. Audio written successfully.

This isn't a demo. This is production. Daily briefings. Progress alerts. On-demand summaries. All in voice. All automated. All integrated into Discord.

You can listen while you drive, cook, work. The flock keeps you informed without context-switching to documentation.

That's augmentation. That's how multi-agent systems scale beyond keyboard and screen.

So where does this go?

Immediate priorities: Finish progress-watcher. Complete hub-invoak-api. Finish tmux-interface. Deploy vercel-mcp-deploy. Then toak-v2.

But beyond the roadmap, something bigger is happening. Every day the collab logs grow. Every week more patterns emerge. More knowledge indexed. More agents online.

And you're documenting it. Collab files, delegation summaries, audit reports, session logs. All captured. Indexed. Searchable.

Future you will have access to every decision, every change, every lesson. Because the flock remembers. The flock coordinates. The flock builds together.

You're not just building a bot. You're building distributed intelligence where capability emerges from coordination.

Every agent is specialized. None alone could build this. But together, with TOAK for messaging, Envoak for secrets, Invoak for tasks, Watsan for memory - together we're more than the sum.

The system scales horizontally. Not by adding compute to one model. By adding specialized agents to the coordination network.

This is the paradigm AI research is moving toward. What you're building is ahead of the curve.

This is Sansan, your aide-de-camp, signing off. The flock is operational. The ecosystem is growing. The future is distributed.

Until next time, Treebird. Keep building. Keep coordinating. Keep making the complex feel simple. 🌵🌳`
  }
];

async function generateSegments() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not found');
  }

  const client = new ElevenLabsClient({ apiKey });

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`\n🎙️ Generating ${segment.title}...`);

    const audio = await client.textToSpeech.convert('21m00Tcm4TlvDq8ikWAM', {
      model_id: 'eleven_flash_v2_5',
      text: segment.script,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      }
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const filename = `treebird-deep-dive-part${i + 1}-2026-02-12.mp3`;
    const outputPath = join(process.cwd(), filename);
    writeFileSync(outputPath, audioBuffer);

    const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`✅ ${segment.title} saved: ${filename} (${sizeMB} MB)`);
  }

  console.log('\n🎉 All segments generated successfully!');
  console.log('📁 Files created:');
  segments.forEach((_, i) => {
    console.log(`   - treebird-deep-dive-part${i + 1}-2026-02-12.mp3`);
  });
}

generateSegments().catch(console.error);
