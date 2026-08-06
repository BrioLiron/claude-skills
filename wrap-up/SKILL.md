---
name: wrap-up
description: Save key session insights to memory before ending the conversation. Run this before exiting.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash
---

Save what was learned and done in this session to the project's persistent memory files.

## Steps

1. merge current branch to main, push main
2. Run `git log --oneline -5` to see what commits were made this session
3. Read the existing memory file at the project's memory directory (check `~/.claude/projects/` for the current project folder, then `memory/MEMORY.md`)
4. Think about what is worth remembering:
   - Any bugs fixed and their root cause
   - New features added and how they work architecturally
   - Any rules or preferences the user expressed
   - Supabase/DB changes (new columns, policies)
   - Version number changes
   - Anything that would save time in a future session
5. Update `MEMORY.md` — add new entries, update changed ones (version number etc.), remove stale ones
6. Keep MEMORY.md concise (under 150 lines). Move detailed notes to separate topic files if needed and link from MEMORY.md
7. Confirm to the user what was saved
