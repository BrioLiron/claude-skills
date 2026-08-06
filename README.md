# claude-skills

Personal [Claude Code](https://claude.com/claude-code) skills, synced across machines.
This repo IS the `~/.claude/skills` folder — each subfolder is one skill, invoked as
`/<folder-name>` in any Claude Code session.

## Skills

- **tasks-app** — installs the tasks dashboard (`TASKS.json` + `/tasks` web UI, originally
  built for BARD) into the current project. Carries the dashboard HTML, a Vite dev-server
  plugin, and a zero-dependency standalone Node server.
- **warm-up** / **wrap-up** — session start/finish routines.

## Setup on a new machine

Fresh machine (no `~/.claude/skills` yet, or it's empty):

```bash
git clone https://github.com/BrioLiron/claude-skills.git "$HOME/.claude/skills"
```

Machine that already has skills in the folder:

```bash
cd ~/.claude/skills
git init -b main
git remote add origin https://github.com/BrioLiron/claude-skills.git
git fetch origin
git merge origin/main --allow-unrelated-histories   # resolve any overlaps, then commit
git push -u origin main
```

## Keeping in sync

After adding or editing a skill on any machine: commit + push here, `git pull` elsewhere.
