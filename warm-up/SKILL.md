---
name: warm-up
description: Session warm-up. Reviews project memory, summarizes where we left off, lists priority tasks, and asks what to do next.
disable-model-invocation: true
---

Perform a session warm-up by following these steps:

1. **Check project memory** — Read your auto-memory files (MEMORY.md and any linked topic files) to recall the project state, architecture, and past decisions.

2. **Review recent changes** — Run `git log --oneline -10` and `git status` to understand what was last worked on. Identify the most recent area of work and summarize where we left off.

3. **List high-priority tasks** — Look for a TODO file, task list, or backlog document in the project (e.g., `TODO.md`, `TASKS.md`, `BACKLOG.md`, or similar). If one exists, list the high-priority items. If none exists, create a `TODO.md` in the project root and ask the user what tasks they'd like to add to it.

4. **Present a summary** to the user:
   - **Where we left off:** Brief summary of the last session's work (based on git history and memory).
   - **High-priority tasks:** Bulleted list from the task doc (if found).
   - **Current state:** Any uncommitted changes or in-progress work.

5. **Ask the user:** "What would you like to work on next?"
