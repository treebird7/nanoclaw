#!/usr/bin/env tsx
/**
 * Episode 1: The GitHub Adventure Begins
 * Voice: Rachel (upbeat, friendly guide)
 */

import { ElevenLabsClient } from 'elevenlabs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const EPISODE1_SCRIPT = `Hey there, future open source contributor! This is your friendly guide to the wonderful world of GitHub collaboration.

So you want to contribute to open source? That's amazing! You're about to join millions of developers who build software together, share knowledge, and create incredible things that anyone can use.

But I know what you're thinking: "Where do I even start? Won't I break something? What if people laugh at my code?"

Deep breath. Let's walk through this together.

First, let's talk about what makes open source so special. When you contribute to an open source project, you're not just writing code - you're joining a community. These are real people who've built something they're passionate about, and they WANT help. They want fresh perspectives. They want YOU.

Here's the secret: every single developer you admire - every maintainer of a popular library, every core contributor to major frameworks - they all started exactly where you are now. Nervous. Uncertain. But they took that first step.

So let's demystify the process. How does GitHub collaboration actually work?

Imagine you find a project you love. Maybe it's a library you use every day, or a tool that makes your life easier, and you notice a typo in the documentation. Or maybe there's a small bug that's been bothering you.

You can't just go in and change their code directly - that would be chaos! Instead, GitHub has this beautiful workflow called "fork and pull request."

Here's how it works, step by step:

Step one: Fork the repository. See that fork button at the top right of any GitHub project? Click it. Boom - you now have your own complete copy of the project. It's yours to experiment with. Break things. Try stuff. Learn.

This is YOUR sandbox. You can't hurt the original project. That's the beauty of it.

Step two: Clone your fork to your computer. This means downloading it so you can work on it locally. You can use the command line with "git clone", or GitHub Desktop if you prefer a visual interface. Either works perfectly.

Now you have the actual code on your machine. You can open it in your editor, run it, explore how it works.

Step three: Create a branch. This is important. Don't work directly on the main branch. Instead, create a new branch with a descriptive name. Something like "fix-typo-in-readme" or "add-dark-mode-toggle".

Why? Because branches keep your work organized. Each branch is like a separate universe where you can make changes without affecting anything else. It's safety and organization in one.

The command is: git checkout -b your-branch-name

That creates a new branch and switches to it immediately.

Step four: Make your changes. This is the fun part! Fix that typo. Add that feature. Write that documentation. Save your files.

And here's a pro tip: make small, focused changes. Don't try to fix ten different things in one pull request. Pick ONE thing and do it really well.

Step five: Commit your changes. A commit is like taking a snapshot of your work. You're saying "here's what I changed and why."

First, stage your changes: git add the-file-you-changed

Then commit with a descriptive message: git commit -m "Fix typo in installation instructions"

And here's where commit messages matter. Don't write "fixed stuff" or "updates". Write clear, meaningful messages that explain WHAT you changed and WHY.

Use imperative mood: "Fix bug" not "Fixed bug" or "Fixes bug". Think of it like giving a command: "If applied, this commit will... fix bug in login form."

Keep the first line under 50 characters. If you need more detail, add a blank line and then write a longer explanation.

Step six: Push your changes to YOUR fork on GitHub: git push origin your-branch-name

This uploads your work to GitHub so others can see it.

Step seven: Create a pull request. Go to the original project on GitHub. You'll see a notification that you recently pushed a branch, with a green button: "Compare and pull request". Click it!

Now you write a description. This is your chance to explain what you did and why it matters.

A good pull request description has:
- A clear title summarizing the change
- Why you made this change (what problem does it solve?)
- How you solved it (especially if it's not obvious)
- Any context that helps reviewers understand your work

Be friendly! Say "Hi! I noticed this issue and thought I could help fix it." Open source maintainers are humans. They appreciate kindness and clear communication.

Step eight: Wait for review. This is where patience comes in. Maintainers might be busy. They might be in a different timezone. They're volunteers doing this in their spare time.

When they review your code, they might suggest changes. This is GOOD! It means they're engaged. They're helping you improve.

Don't take feedback personally. Code review isn't criticism of you as a person - it's collaboration to make the code better.

Respond to comments. Ask questions if something's unclear. Make the suggested changes. Push new commits to your branch - they automatically appear in the pull request.

And here's something beautiful: this process makes you a better developer. Every review teaches you something. Every discussion deepens your understanding.

Now, how do you find beginner-friendly projects?

Look for labels like "good first issue", "beginner friendly", "help wanted", or "first-timers-only". These are issues that maintainers have specifically tagged as good for newcomers.

GitHub has a built-in way to find these. Go to any project and click on Issues, then filter by labels.

Or use websites like goodfirstissue.dev or firstcontributions.github.io - they aggregate beginner-friendly issues across thousands of projects.

My advice? Start with projects you actually use. You'll be more motivated, and you already understand what the project does.

Read the CONTRIBUTING.md file. Most projects have one. It explains their specific rules, coding style, how to run tests, what they expect in pull requests.

Follow their guidelines. It shows respect and makes your contribution more likely to be accepted.

Start SMALL. Your first contribution doesn't need to be a major feature. Fix a typo. Improve documentation. Add a test. These are valuable contributions that help you learn the workflow without overwhelming complexity.

And here's a secret: documentation contributions are incredibly valuable. Many developers focus on code and neglect docs. If you can write clearly and explain things well, you're filling a huge need.

Let's talk about code review etiquette, because this matters:

When your code is being reviewed, remember: the reviewer is on your side. They want your contribution to succeed. They're taking time from their day to help improve your work.

Respond to every comment, even if just to say "good idea, fixed!" It shows you're engaged.

If you disagree with a suggestion, explain why respectfully. "I considered that approach, but went with this because..." Reasoned discussion is welcome.

Don't ghost. If you can't finish the work, that's okay! Just comment saying "I don't have time to complete this right now, feel free to close or reassign." Maintainers appreciate closure.

When reviewing others' code (yes, you can review too!), be kind. Frame feedback as questions or suggestions, not commands: "What do you think about..." instead of "Change this to..."

Praise good work. If you see elegant code or a clever solution, say so! Positive feedback motivates people.

Provide examples when possible. Don't just say "this could be better" - show HOW it could be better.

And here's the most important thing: everyone was a beginner once. The open source community is generally welcoming and supportive. Yes, there are occasional jerks, but they're the exception, not the rule.

If you encounter hostility, know that it reflects on them, not you. Find a different project with a friendlier community. They exist, and they're wonderful.

So what's stopping you? Nothing. You have everything you need.

Pick a project. Find a good first issue. Fork it. Make a change. Submit a pull request.

Your first contribution might be tiny. That's perfect. You're learning the workflow, building confidence, joining the community.

And then do it again. And again. Each time gets easier. Each time you learn more.

Before you know it, you're not just using open source - you're building it. You're part of something bigger than yourself.

The open source world is waiting for you. Welcome to the flock. 🚀✨`;

async function generateEpisode1() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not found');

  const client = new ElevenLabsClient({ apiKey });

  console.log('🎙️ Generating Episode 1: The GitHub Adventure Begins...');

  // Rachel voice - upbeat and friendly
  const audio = await client.textToSpeech.convert('21m00Tcm4TlvDq8ikWAM', {
    model_id: 'eleven_turbo_v2_5',
    text: EPISODE1_SCRIPT,
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.6,
      use_speaker_boost: true
    }
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  const outputPath = join(process.cwd(), 'github-guide-episode1-adventure-2026-02-12.mp3');
  writeFileSync(outputPath, audioBuffer);

  const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Episode 1 saved: ${sizeMB} MB`);
}

generateEpisode1().catch(console.error);
