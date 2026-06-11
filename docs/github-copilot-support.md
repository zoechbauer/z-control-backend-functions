# GitHub Copilot Support Guide for Ionic Setup

This guide describes a practical Copilot setup that keeps existing projects stable while letting you reuse proven guidance across repositories.

## Goal

1. Keep existing projects unchanged when they are already published.
2. Reuse proven guidance from previous projects.
3. Separate project-specific rules from personal global preferences.
4. Keep Copilot behavior predictable for coding, reviews, and commit messages.

## The Three Building Blocks

### 1. Chat Modes

Use chat modes when you want a different behavior in the current chat session.

Typical use cases:

- Code review focused on bugs and risks.
- Implementation focused on fast coding.
- Documentation focused on explanation quality.

Key property:

- Session-oriented; best for temporary behavior changes.

Folder and name:

- project scope: `.github/chat-modes/*.mode.md`
- User profile: `<profile>/chat-modes/*.mode.md`

### 2. Instructions

Use instructions for rules that should apply automatically.

Typical use cases:

- Coding conventions.
- Architecture boundaries.
- Testing conventions.
- Commit message style.

Key property:

- Policy-oriented; best for default behavior without repeating prompts.

Folder and name:

- project scope: `.github/instructions/*.instructions.md`
- User profile: `<profile>/instructions/*.instructions.md`

### 3. Prompts

Use prompts for repeatable tasks you trigger manually.

Typical use cases:

- Draft a PR description.
- Generate release notes.
- Build a migration checklist.

Key property:

- Task-oriented; best for reusable command-like workflows.

Folder and name:

- project scope: `.github/prompts/*.prompt.md`
- User profile: `<profile>/prompts/*.prompt.md`

## Decision Rules

Use this quick rule set:

1. If it should always apply automatically, use instructions.
2. If it should run only when requested, use a prompt.
3. If you only want temporary behavior for one chat, use a chat mode.

## Project Scope vs User Scope

### Project Scope

Place customization inside the repository when the whole team should share it.

Use for:

- Project architecture and folder conventions.
- Team test strategy.
- Repository-specific review and quality rules.

### User Scope

Place customization in your user prompts/instructions folder when the preference should follow you across projects.

Use for:

- Personal writing style.
- Preferred answer structure.
- Personal commit style conventions.

### Priority order on conflicts

When there are conflicting rules, Copilot applies them in this order:

1. Project-wide instructions (`.github/copilot-instructions.md`)
2. Project-specific instructions (`.github/instructions/*.instructions.md`)
3. User-level instructions (`<profile>/instructions/*.instructions.md`)
4. Prompts (`.github/prompts/*.prompt.md` or `<profile>/prompts/*.prompt.md`)
5. Chat modes (`.github/chat-modes/*.mode.md` or `<profile>/chat-modes/*.mode.md`)

Why this order:

Project rules are team standards — they should enforce consistency across the whole team.
User rules are personal defaults — they fill in gaps when the project doesn't specify something.
If both exist and conflict, the project rule wins to keep the team aligned.

Note: Prompts and chat modes are orthogonal to instructions — they don't conflict with instruction rules but rather complement them. Prompts are triggered manually for specific tasks, and chat modes apply temporarily to a single session. The precedence above shows where each type lives; prompts and chat modes don't override instruction-based behavior.

## Naming

The file name should describe its purpose clearly, but the suffix is what matters for discovery.
For example, `commit-message-style.instructions.md` is an instruction file for commit message style rules, while `pr-summary.prompt.md` is a prompt for generating PR summaries.

Do not rely on extra subfolders inside `prompts` or `instructions` for discovery.

Use subfolders only when you are organizing your own files, not because Copilot needs them.

If you need folder-specific behavior, use either:

1. `applyTo` inside an `.instructions.md` file for matching file patterns.
2. `AGENTS.md` in a root or subfolder when you want hierarchical project guidance.

## Why `copilot-instructions.md` Lives in `.github`

`copilot-instructions.md` is the single project-wide instruction file for general standards.

It lives in `.github` because:

1. It is meant to be one canonical file for the repository.
2. It applies broadly to the project, not to a single task.
3. The Copilot workflow expects it in this well-known location.

Use `AGENTS.md` instead when you want instructions to vary by subfolder in a larger repository.

## Practical Recommendation

For your Ionic project:

1. Keep one project-wide `copilot-instructions.md` in `.github` for shared rules.
2. Keep reusable task prompts in `.github/prompts/*.prompt.md` or your user profile `prompts` folder.
3. Keep reusable task instructions in `.github/instructions/*.instructions.md` or your user profile `instructions` folder.
4. Use filenames to describe the purpose clearly; do not depend on nested folders for discovery.

## Minimal Copilot Setup for an Ionic Project

### Setup Checklist

1. Add one project instruction file for architecture, Angular/Ionic patterns, and test expectations.
2. Add one small prompt for recurring tasks, such as PR summary or release notes.
3. Keep personal commit-style preferences in user-level instructions.
4. Review instruction files periodically and remove outdated or duplicated rules.

### Suggested Working Flow

Use this sequence for predictable results:

1. Start with project instructions for always-on rules.
2. Run prompts for repeatable tasks like release notes or PR summaries.
3. Use chat modes only for temporary session behavior shifts.
4. Validate generated output against build, test, and documentation consistency.

## Suggested Quality Checklist

Before relying on generated output, verify:

1. Build and test commands pass.
2. Security-sensitive files are not accidentally tracked.
3. Environment handling stays local-only where required.
4. Commit messages match the chosen team convention.
5. Code style and architecture rules are followed.
