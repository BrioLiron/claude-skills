---
name: tasks-app
description: Install the tasks dashboard (TASKS.json + /tasks web UI, originally built for BARD) into the current project. Use when the user asks to add the tasks app, tasks dashboard, or task tracker to a project.
---

# Tasks app installer

A tiny per-project task tracker: a single JSON file (`TASKS.json` in the repo root) as the source of truth, edited through a dark-themed web dashboard at `/tasks`. Tasks have stable `#N` numbers (never reused) so the owner and Claude can reference "task 12" unambiguously across sessions. The dashboard supports add / priority groups (high/medium/low) / status pills (todo/doing/done) / per-task notes / recursive subtasks with collapse-expand / **category shelves** (＋ Category adds a thin organizing row with no number, no status, no priority; shelves sit as their own band above the priority groups, and the tasks filed under one keep their own global #numbers — ✕ dissolves a shelf without deleting its tasks) / **drag-anywhere nesting** (drop a row onto a task's lower half to nest it as that task's subtask at any depth, onto a shelf to file it; in the slot between rows a left/right drag picks the depth, 34 px per level, and the receiving row lights up; numbers stay stable — a task's global # is stashed while it serves as a subtask and returns the moment it's dragged out) / a persisted "hide done" toggle (a priority group whose tasks are all done drops its header) / **search by title or #number** (a search box under the add bar: text matches titles case-insensitively, `12`, `#12` or `12-1` match exactly that task with its subtasks — never `#120`; a match shows with its parents and subtasks as dimmed context, done tasks included; `/` focuses the box from anywhere, Esc clears), and autosaves.

All files to install live in this skill's `assets/` directory (next to this SKILL.md):

- `tasks-dashboard.html` — the whole UI, one file, no build step. Contains the placeholder `__PROJECT_NAME__` (2 occurrences: `<title>` and `<h1>`).
- `vite-plugin-tasks.mjs` — for Vite projects: a dev-server plugin serving `GET /tasks`, `GET /__tasks`, `POST /__save-tasks`.
- `tasks-server.mjs` — for everything else: a zero-dependency Node http server with the same three endpoints (default port 5190, `--port <n>` to change, binds 127.0.0.1 only).

## Install steps

1. **Project name**: take `name` from the project's `package.json` if there is one, else the folder name. Ask only if truly ambiguous.
2. **Copy the dashboard** to `<root>/tools/tasks-dashboard.html` (create `tools/` if needed; if the project keeps dev utilities in a different conventional folder like `scripts/`, use that and adjust paths below). Replace both `__PROJECT_NAME__` occurrences with the project name.
3. **Create `TASKS.json`** in the repo root **only if it doesn't exist** (never overwrite an existing one):
   ```json
   {
     "updated": null,
     "nextNum": 1,
     "tasks": []
   }
   ```
   It should be git-tracked (it's shared project state, not a local scratch file).
4. **Wire the server** — pick ONE:
   - **Vite project** (has `vite` in devDependencies / a `vite.config.*`): copy `vite-plugin-tasks.mjs` next to the dashboard, then import it in the Vite config and add `tasksDashboardPlugin()` to `plugins`. The dashboard rides the existing dev server: `http://localhost:<devport>/tasks`. The plugin finds the dashboard HTML next to its own file, so keep the two files together.
   - **Anything else** (or the user prefers a separate process): copy `tasks-server.mjs` next to the dashboard. If there's a `package.json`, add `"tasks": "node tools/tasks-server.mjs"` to `scripts`; otherwise just tell the user the command. It must be run from the repo root (TASKS.json resolves against the cwd). Before settling on port 5190, check it's free.
5. **Verify**: start (or use the already-running) server, `curl` the `/tasks` and `/__tasks` endpoints (expect 200 + HTML / JSON). Don't test `POST /__save-tasks` against a TASKS.json that already has content — a bad payload can't corrupt it (validated), but a "successful" test write would clobber real tasks.
6. **Tell the user** the URL, and offer to add a short "Tasks" note to the project's CLAUDE.md (see below).

## Task format (what Claude needs to know to work with TASKS.json)

```json
{ "id": "tXXXX", "num": 12, "title": "…", "status": "todo|doing|done", "priority": "high|medium|low", "notes": "…",
  "nextSub": 3, "subtasks": [ { "id": "tYYYY", "num": 1, "title": "…", "status": "…", "priority": "…", "notes": "…" } ] }
{ "id": "tZZZZ", "kind": "category", "title": "…", "notes": "…", "subtasks": [ /* real tasks with global nums */ ] }
```

- `num` is the stable reference — when the owner says "task 12", match on `num`. Never renumber or reuse numbers; new tasks take `nextNum` and increment it.
- Subtasks nest recursively to any depth (`subtasks` inside `subtasks`), each level numbered per-parent via its own `nextSub` — "task 12-1-3" is the path of `num`s from the top. Same never-reuse rule at every level. A subtask's `priority` is a label only; subtasks always render under their parent, and deleting a task deletes its whole subtree.
- `kind: "category"` records are organizing shelves: top-level only, NO `num`/`status`/`priority` (the dashboard scrubs those fields off shelves on load). Their `subtasks` are REAL tasks that draw GLOBAL numbers from `nextNum` — filing/unfiling never renumbers. Deleting a shelf in the UI dissolves it (its tasks surface to top level); when editing the file directly, don't delete a shelf's subtree by accident.
- A task may carry `gnum`: its stashed global number while it serves as a subtask (the dashboard restores `num = gnum` when the task is dragged back to top level / a shelf). Preserve `gnum` when editing by hand.
- Claude may edit TASKS.json directly (it's pretty-printed JSON), but the recommended convention: **Claude records outcomes in `notes` ("Implemented …, needs testing") and lets the owner flip `status` to done after verifying.** Offer this convention to the user; don't impose it.

Suggested CLAUDE.md snippet (adjust paths/URL to what was actually installed):

> **Tasks**: `TASKS.json` (repo root) is the task list; dashboard at `http://localhost:<port>/tasks` (see `tools/`). Reference tasks by their stable `#N`. Record work outcomes in a task's `notes`; the owner flips `status` to done after testing.

## Known trap — stale-tab clobber

The dashboard holds the whole task list in memory and rewrites the entire file on every edit. An open dashboard tab that loaded before an on-disk edit (e.g. Claude editing TASKS.json) will **clobber that edit** on its next autosave. Warn the user: reload dashboard tabs after editing the file directly, and reload before editing the file if a tab has been open a while.
