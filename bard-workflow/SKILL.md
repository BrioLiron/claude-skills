---
name: bard-workflow
description: The working rules for the BARD project (and the template for other Brio projects) — git branch policy, versioning, the release procedure, owner-approval rules, task tracking, and the environment gotchas. Load when working in the BARD repo, or when asked how git/versions/releases are handled.
---

The working conventions established on **BARD** (Brio Awesome Realtime Display). Follow them exactly in the BARD repo; treat them as the default template for other Brio projects unless that project says otherwise.

## Git & branches

- **All day-to-day work happens on `development`. `main` is strictly for releases.** Never commit work directly to `main` — the only sanctioned way to touch it is `npm run release`. (Any exception must be explicitly ordered by the owner, per case.)
- The release script pushes nothing. Push manually afterwards: `git push origin development main --follow-tags`.
- Batch commits by scope: one focused commit per feature/fix, not one mega-commit. When one big file (e.g. `main.js`) holds several features, split it across commits with staged hunk patches (`git apply --cached`; produce patches with `git diff --output=<file>`, never piped through PowerShell).
- `public/settings.json` is **intentionally dirty** — it holds the owner's saved server default. Never commit, revert, or "clean up" its diff; the release preflight explicitly exempts it.

## Versioning

- **`development` is always one version ahead of `main`.** The version lives in `package.json` (shown by the app's top-left version badge).
- `npm run release` enforces this: it merges dev's CURRENT version into `main` + annotated tag `v<ver>`, then immediately bumps `development` (`npm version patch`) so the next dev cycle has its own number. Never bump versions by hand outside that flow.

## Releases — hard rules

1. **NEVER run `npm run release`, touch `main`, or push `main` without the owner's explicit, per-release approval.** A wrap-up routine saying "merge to main" still means ASK first.
2. The **full test suite runs ONLY at release time** — and even then, ask before running it. During normal work, run only the verify scripts relevant to the change (`node tests/run.mjs <filter>`).
3. Every release also **builds the desktop exe from `main`** (`npm run app:build` → `release/BARD-<ver>.exe`) — from main, not development, or the version stamp is wrong. Watch that the build doesn't overwrite a previous version's exe.
4. Every release gets a **release notes file** (owner rule 2026-09-08 — don't call it a "Slack" file): `release/BARD-<ver> release notes.txt`, named EXACTLY like the exe it announces plus " release notes", living next to it in `release/` (tracked via the `.gitignore` exception `!release/* release notes.txt`), committed on `development` BEFORE `npm run release` (the preflight refuses a dirty/untracked tree). Written from the version's changelog entry — fun and light, grouped by theme, chat formatting (`*bold*`, `:emoji:` codes), not too long (`release/BARD-0.0.14 release notes.txt` is the tone template).
5. Release preflight refusals are by design: off-`development`, dirty tree (settings.json exempt), or settings.json diverging between branch tips all abort. On merge failure it rolls back all pre-merge commits.

## Running release notes (changelog feed)

- **`RELEASE-NOTES-NEXT.txt`** (repo root) is the running notes file. Whenever an owner-visible feature or fix lands, append **one user-phrased line IN THE SAME COMMIT** (`#` lines are comments).
- `npm run release` consumes it: its lines become the release's changelog entry (`src/changelog.json` + regenerated `CHANGELOG.md`, committed on development BEFORE the merge), and the file resets to its header. If empty, the release falls back to commit subjects in `main..development`. A hand-curated `src/changelog.json` entry for the version always wins.
- The changelog drives the in-app one-time "What's new" popup.

## Working with the owner

- **The owner tests before commit.** Hand new features over for manual testing first; run the relevant verify cluster and commit only after their approval.
- **Never mark tasks done.** In `TASKS.json` (the `/tasks` dashboard), record outcomes in `notes` ("Implemented …"); the owner flips `status` to done after testing. Reload the dashboard tab before editing the file — a stale tab clobbers edits.
- When the owner discards work, archive it (patch/zip + a memory note with their taste verdicts) before dropping it — the "why it was rejected" is as valuable as the code.

## Testing model (context for the rules above)

- No unit tests. Behavior is verified by Playwright scripts driving a real GPU browser and diffing screenshots — one `tests/verify/verify-<feature>.mjs` per feature. After a change, write/update the matching verify script and confirm "ERRORS: none" before claiming it works.
- New features must expose whatever a test needs on `window.__diamond`.
- Cluster test runs per change (don't rerun the world); full suite only at release, with permission.

## Environment gotchas (Windows / PowerShell)

- **CRLF churn:** file edits can flip LF→CRLF and bloat a diff to whole-file. Check `git diff --stat` before committing; `git diff --ignore-cr-at-eol` proves the churn is content-free before normalizing.
- **PowerShell 5.1:** no `&&`/`||`; multi-line commit messages go through single-quoted here-strings (`git commit -m @'…'@`) — and double quotes inside them can split into bogus pathspecs. Never pipe `git diff` output through PowerShell; use `--output=<file>`.
- **Ports + where to work (owner rule 2026-09-08): ALWAYS work directly in the MAIN checkout, served by the owner's `run.bat` on :5180.** Do not open extra dev-server ports and do not build features in worktrees — their :5180 tabs hot-reloading on src edits is accepted; git revert is the safety net. (Still warn before anything that could destructively ADOPT over their unsaved in-browser scene — localStorage is not revertable.) The verify suite still spawns its own **:5174** (hardcoded in the tests — that's the harness, not a dev port); **:5173 is forbidden** — it belongs to the owner's other project (V.I.B.E.S). PowerShell `npm run dev` drops `--port` flags; use `npx vite --port 5174 --strictPort`.
- Don't `TaskStop` a piped npm build — it orphans electron-builder (EBUSY next build); capture exit codes without a pipe.

## Session hygiene

- Keep the project's persistent memory (`~/.claude/projects/<project>/memory/`) current: session outcomes, owner verdicts, traps. `MEMORY.md` is the index — one line per memory.
- Convert relative dates to absolute when writing notes.
