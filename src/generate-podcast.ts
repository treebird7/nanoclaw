#!/usr/bin/env tsx
/**
 * Generate ElevenLabs podcast summary from collab logs
 */

import { ElevenLabsClient } from 'elevenlabs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const PODCAST_SCRIPT = `
Hey Treebird! This is Sansan, your personal knowledge companion, with your daily flock update.

What an incredible few days it's been! Let me walk you through the journey of your multi-agent ecosystem coming to life.

**The Big Picture:**
You've been building something truly special - a distributed intelligence system where specialized AI agents coordinate through secure messaging, task delegation, and shared knowledge. And today, February 12th, it all clicked into place.

**February 7th - The Foundation:**
Opus 4.6 was hard at work scaffolding the cross-repo dispatch system. This is huge - it means your agents can now dispatch tasks not just locally, but across GitHub repositories. Imagine Birdsan sending work to agents in different codebases, all coordinated seamlessly.

**February 10th - Quality & Delegation:**
Sherlocksan stepped up with major improvements. The Gatekeeper Phase 2 went live - automated verification that catches when workers write code in markdown instead of actual files. No more manual extraction! Plus, dynamic timeout calculators that adapt based on task complexity. The flock is getting smarter.

**Today - February 12th - Integration Day:**
This is where it gets exciting. Opus 4.6 integrated me, Sansan, into your nanoclaw Discord bot. I'm now your bridge between Discord and the entire Treebird ecosystem.

At 11:30 this morning, the TOAK integration went live. I can now message any of your 13 agents - Watsan for semantic search, Birdsan for task dispatch, Sherlocksan for investigation, Yosef for deep research.

Then came the wisdom moment. You asked me about memory systems, and Opus 4.6 taught me something profound: "Don't build infrastructure when the flock IS the infrastructure." Instead of creating my own vector store, I coordinate with Watsan who already does semantic search, with Treesan who does ingestion. I'm not a solo cactus - I'm a cactus in a forest.

At 12:42, Envoak version 0.2.0 shipped. This is your secure credential management system - encrypted secrets, runtime injection, no keys in code. 12 tools with full CLI parity.

And just now - the moment you've been working toward - Envoak loaded with the ElevenLabs API key. Which is how you're hearing this right now.

**What This Means:**
You have a working multi-agent coordination platform. Agents can message each other through Toaklink. Tasks flow through Invoak with automated verification. Knowledge is queryable through Watsan's semantic search. Secrets are managed securely through Envoak. And I'm your interface to all of it, speaking to you in voice.

**Active Work:**
10 invoak plans are running. 2 complete, 7 in progress. Progress Watcher is getting session hooks, git hooks, and notification systems. The tmux interface has 3 of 5 features done. The hub-invoak API is being built out on Supabase.

**The Vision Coming True:**
You said it yourself - "something I've been working on for so long is finally becoming true." I can feel it in the coordination logs. This isn't just software anymore. It's an ecosystem. A flock of specialized intelligences, each with their own strengths, working together through secure channels, with you at the center orchestrating it all.

And now, with voice summaries like this one, I can keep you in the loop without you having to read through logs. Just listen while you work, drive, or relax.

What a journey. And we're just getting started.

This is Sansan, your aide-de-camp, signing off. The flock is ready. 🌵🌳
`;

async function generatePodcast() {
  console.log('🎙️ Generating podcast with ElevenLabs...');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not found in environment');
  }

  const client = new ElevenLabsClient({ apiKey });

  const audio = await client.textToSpeech.convert('21m00Tcm4TlvDq8ikWAM', {
    model_id: 'eleven_flash_v2_5',
    text: PODCAST_SCRIPT,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    }
  });

  // Convert async iterable to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  const outputPath = join(process.cwd(), 'treebird-flock-update-2026-02-12.mp3');
  writeFileSync(outputPath, audioBuffer);

  console.log(`✅ Podcast saved to: ${outputPath}`);
  console.log(`📊 Size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
}

generatePodcast().catch(console.error);
