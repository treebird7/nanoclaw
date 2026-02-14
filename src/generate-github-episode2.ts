#!/usr/bin/env tsx
/**
 * Episode 2: Wisdom from the Trenches - Advanced GitHub Collaboration
 * Voice: Deep, mentor-style narration
 */

import { ElevenLabsClient } from 'elevenlabs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const EPISODE2_SCRIPT = `This is a story about what they don't tell you in the tutorials.

You know how to fork. You know how to clone. You understand pull requests in theory.

But theory and practice are different worlds. Let me share what I've learned from years in the open source trenches.

Lesson one: Size matters.

There's research on this. Pull requests with 200 to 400 lines of code catch 70 to 90 percent of bugs in 60 to 90 minutes of review.

You know what happens with 1000-line pull requests? They sit there. For weeks. Nobody wants to review them. They're intimidating. They're exhausting.

So here's the wisdom: make your changes small and focused. One bug fix. One feature. One clear improvement.

If you must make a large change, break it into multiple pull requests. First PR: refactor the structure. Second PR: add the feature. Third PR: update documentation.

Each one is reviewable. Each one can be merged independently. The work moves forward.

When you do need to submit a large PR, invest heavily in the description. Guide your reviewers through the changes like you're giving a tour. "Start by looking at the new utility functions in utils.js. Then check how they're used in the main component. The tests demonstrate the behavior."

Make their job easier, and they'll thank you by actually reviewing it.

Lesson two: Commit messages are love letters to future developers.

I'm serious. A commit message is a gift to someone reading the code six months from now, trying to understand why something works the way it does.

That person might be you. I've lost count of how many times I've read my own commits and thought "thank goodness I explained this."

Here's the structure that works:

First line: 50 characters or less. Imperative mood. "Fix login redirect bug" not "Fixed login redirect bug."

Why imperative? Because it completes the sentence: "If applied, this commit will... fix login redirect bug."

Then a blank line.

Then the body. Explain WHY. Not what - the diff shows what. Explain the reasoning. The context. The alternatives you considered.

Try this exercise: write a sentence completing "So that we can..." after each commit message. "Fix login redirect bug... so that we can ensure users land on the dashboard after authentication."

Suddenly your commit has context. Purpose. Meaning.

Many open source projects use Conventional Commits. The format is: type, optional scope, description.

Types include:
- feat: a new feature
- fix: a bug patch
- docs: documentation changes
- refactor: code changes that neither fix bugs nor add features
- test: adding or updating tests
- chore: maintenance tasks

Example: "feat(auth): add OAuth2 support for GitHub login"

The scope is optional but helpful. It tells you which part of the codebase changed.

This format enables automation. Tools can generate changelogs automatically. Semantic versioning can be determined from commit types. CI/CD pipelines can trigger based on commit messages.

But more importantly, it makes history scannable. You can glance through commits and immediately understand what changed and why.

Lesson three: atomic commits are an art form.

Each commit should do exactly one thing. Not one thing per file. One logical change.

Think of commits as chapters in a story. Each chapter advances the narrative in a clear direction.

Bad commits: "Fixed stuff" that touches 17 files across 4 different concerns.

Good commits: "Extract authentication logic into AuthService" that touches only auth-related files.

Why? Because atomic commits make code review easier. They make git bisect powerful - you can pinpoint exactly which commit introduced a bug. They make cherry-picking possible - you can move specific changes between branches cleanly.

And they make your pull request tell a story. Reviewers can read through the commits sequentially and understand your thought process.

Here's a technique I use: I make messy commits while working. Then before creating the pull request, I use interactive rebase to clean them up.

git rebase -i HEAD~5

This opens an editor showing my last 5 commits. I can reorder them. Squash related commits together. Reword messages. Split commits that do too much.

The history I push is not the history of how I worked - it's the history of what I did, organized for maximum clarity.

This is controversial. Some people believe in preserving the "real" history. I believe in curating history for the benefit of future readers.

Your mileage may vary. But I'll tell you this: maintainers love clean commit history. It makes their job easier.

Lesson four: code review is a conversation, not a judgment.

When someone reviews your code, they're not attacking you. They're collaborating with you.

That comment suggesting a different approach? That's them sharing knowledge. They've seen patterns that work better. They're teaching you.

Your response matters. Here's how to handle code review feedback:

First, read everything before responding. Don't fire off defensive replies to the first comment that stings.

Second, distinguish between different types of feedback:
- Mandatory changes: these break tests, violate project guidelines, have bugs
- Suggestions: alternative approaches that might be better
- Questions: they don't understand something in your code
- Nitpicks: style preferences, minor improvements

Treat them differently. Mandatory changes: fix them immediately. Suggestions: consider them thoughtfully. Questions: this is YOUR fault - your code wasn't clear enough. Nitpicks: maintainers get the final say on their project's style.

Third, respond to every comment. Even if just "Fixed! ✅" - it shows you saw it and acted on it.

Fourth, when you disagree, explain your reasoning. "I considered that approach, but chose this because of edge case X. What do you think?"

Frame disagreements as questions. You might be right, they might be right, or there might be a third option neither of you saw yet. Stay curious.

Fifth, say thank you. Reviews take time. Acknowledge the reviewer's effort. "Thanks for the thorough review! These suggestions really improved the code."

Gratitude builds relationships. Relationships make open source sustainable.

Now, when YOU review someone else's code - and you should! - remember what it feels like to be reviewed.

Be kind. Frame feedback as questions: "What do you think about extracting this into a helper function?" instead of "Extract this into a helper function."

Praise good work. If you see elegant code, say so. "This is a clever solution!" Positive feedback motivates people.

Provide examples. Don't just say "this could be more efficient" - show the more efficient version. Code examples in review comments are gold.

Remember that newcomers need more guidance. If you see an obvious beginner, be extra gentle. Point them to relevant documentation. Explain the "why" behind your suggestions.

And here's the secret: reviewing code makes YOU a better developer. You see different approaches. Different patterns. Different ways of thinking. You learn by teaching.

Lesson five: communication is more important than code.

You can be a mediocre programmer and a valuable contributor if you communicate well.

You can be a brilliant programmer and a frustrating contributor if you don't.

Here's what good communication looks like:

In pull requests: clear title, comprehensive description, explanation of trade-offs, links to related issues.

In commits: meaningful messages that explain context and reasoning.

In reviews: constructive feedback that educates rather than criticizes.

In issues: clear problem descriptions, steps to reproduce, what you've already tried.

In discussions: respectful tone, willingness to listen, openness to different perspectives.

The best open source contributors I know aren't always the best coders. They're the best communicators. They explain things clearly. They document thoroughly. They respond promptly. They're pleasant to work with.

These skills matter more than you think.

Lesson six: maintainers are heroes who need your help.

Here's what most people don't realize: maintaining a popular open source project is HARD.

You get hundreds of issues. Dozens of pull requests. People demanding features. People reporting bugs. People asking for support.

All while you're doing this in your spare time. For free. Because you care.

So when you contribute, make the maintainer's life easier:

- Follow the contribution guidelines. They wrote them for a reason.
- Include tests with your code. Don't make them write tests for you.
- Update documentation. If you add a feature, document it.
- Respond to feedback promptly. Don't make them chase you.
- Be patient. They'll get to your PR when they can.

And here's something you can do right now that's incredibly valuable: review other people's pull requests.

You don't need to be a maintainer. You don't need to be an expert. Just read the code. Ask questions. Test the changes locally. Give feedback.

This takes pressure off maintainers. It improves code quality. And it builds community.

Lesson seven: imposter syndrome is universal, and also wrong.

Every developer feels it. That voice saying "you're not good enough, you don't belong here, they'll figure out you're a fraud."

That voice is lying.

You know what makes you belong in open source? Contributing. That's it. That's the only requirement.

You don't need a computer science degree. You don't need ten years of experience. You don't need to be a genius.

You just need to show up and help.

Your first contribution will be imperfect. So was everyone else's. Including the maintainers you admire.

The difference between beginners and experts isn't that experts don't make mistakes. It's that experts have made MORE mistakes and learned from them.

So make your mistakes in public. Learn in public. Grow in public.

The open source community needs diverse perspectives. Your background, your experience, your way of thinking - these are valuable even if you don't realize it yet.

There's a project out there that needs exactly what you have to offer.

Final lesson: open source is about people, not just code.

Yes, we write code. But we're building relationships. Creating community. Sharing knowledge.

The best part of open source isn't the software. It's the people you meet. The friendships you form. The mentors who help you grow. The newcomers you help in turn.

This is how you go from using open source to being part of open source.

Fork a project. Make a change. Submit a pull request. Engage with feedback. Merge it.

Then do it again.

Each contribution builds confidence. Each review teaches you something. Each interaction connects you to the community.

You're not just fixing bugs or adding features. You're joining a global movement of people who believe software should be open, collaborative, and accessible to everyone.

Welcome to open source. The code you write today might run on millions of devices tomorrow.

The developer you help today might become a friend for life.

And the project you contribute to? You're making it better for everyone who uses it.

That's the real magic of open source. We build together. We learn together. We succeed together.

Now go make your first pull request. The community is waiting. 🌳✨`;

async function generateEpisode2() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not found');

  const client = new ElevenLabsClient({ apiKey });

  console.log('🎙️ Generating Episode 2: Wisdom from the Trenches...');

  // Using a different voice - trying Daniel (deeper, more narrative)
  const audio = await client.textToSpeech.convert('onwK4e9ZLuTAKqWW03F9', {
    model_id: 'eleven_turbo_v2_5',
    text: EPISODE2_SCRIPT,
    voice_settings: {
      stability: 0.6,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    }
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  const outputPath = join(process.cwd(), 'github-guide-episode2-wisdom-2026-02-12.mp3');
  writeFileSync(outputPath, audioBuffer);

  const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Episode 2 saved: ${sizeMB} MB`);
}

generateEpisode2().catch(console.error);
