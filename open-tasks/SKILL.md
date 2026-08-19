---
name: open-tasks
description: Open the project's tasks dashboard (the /tasks board over TASKS.json) in a NEW browser-pane tab with minimal token spend — no screenshot, no file inspection, one-line report. Use when the user says "run tasks", "open tasks", "show the tasks board/dashboard", or wants to see TASKS.json in the UI. Not for installing the dashboard (that's tasks-app).
---

# Open the tasks dashboard

The dashboard rides the dev server at `http://localhost:<port>/tasks`. In BARD the launch config is **`bard`** on port **5180**. The values below are known — do NOT inspect `.claude/launch.json`, `vite.config.js` or `TASKS.json` first, and do not `curl` anything.

## Steps (4 tool calls — no Bash, no screenshot, no read_page)

1. `preview_start {name: "bard"}` — reuses the running :5180 server (starts it only if it is down) and guarantees the Browser pane exists. Ignore the tabId it returns.
2. `tabs_create` → note the new `tabId`.
3. `navigate {url: "http://localhost:5180/tasks", tabId}` — the result's tab list must show the title **`BARD Tasks`**. If it doesn't (server still booting), wait 2 s and navigate once more.
4. `get_page_text {tabId, max_chars: 160}` — the header carries the counts (`N todo · N doing · N done`) and `Loaded`.

Report exactly one line, e.g. `Tasks dashboard open in a new tab: http://localhost:5180/tasks — 43 todo · 3 doing · 12 done.` No screenshot, no task listing; use `find` / `read_page` only if the user then asks about specific tasks.

## Rules

- Never write `TASKS.json` on disk while a dashboard tab is open — its autosave clobbers the file from memory. Edit tasks through the UI, or ask the owner to close the tab first.
- Other projects (dashboard installed via `tasks-app`): same steps with that project's launch-config name / dev port, or `http://127.0.0.1:5190/tasks` when it runs `tools/tasks-server.mjs` (`npm run tasks`) — read `.claude/launch.json` only if the port is unknown.
