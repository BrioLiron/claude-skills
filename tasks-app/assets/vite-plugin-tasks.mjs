// Dev-only task manager as a Vite plugin: GET /tasks serves the dashboard
// (tasks-dashboard.html, next to this file), GET /__tasks returns TASKS.json
// (project root), POST /__save-tasks rewrites it pretty-printed. TASKS.json is
// the single source of truth — the dashboard reorders/edits it, and it stays
// hand- and Claude-readable.
//
// vite.config.js:
//   import tasksDashboardPlugin from './tools/vite-plugin-tasks.mjs';
//   export default defineConfig({ plugins: [tasksDashboardPlugin(), ...] });

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// TASKS.json has two editors: this dashboard, and whoever is editing the file
// directly — Claude, an editor, a git checkout. The dashboard POSTs its WHOLE
// tree on every autosave and only read the file at startup, so anything written
// to disk while a tab was open was silently overwritten, and a tab left open
// for a while would undo work committed minutes earlier. That was worked around
// by hand ("reload the dashboard after editing"), which only works if you
// remember, every time.
//
// Every response now carries a `rev` — a hash of the file as served. A save
// sends the rev it started from, and if the file has moved on since, the server
// 3-way merges rather than rejecting: rejecting only moves the loss to the
// other side. `history` holds recent revisions so there is a real base to diff
// against.
const HISTORY_MAX = 16;
const history = new Map(); // rev -> parsed snapshot as it was served

function revOf(text) {
  let h = 0x811c9dc5; // FNV-1a; collisions here cost a needless merge, nothing more
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + '-' + text.length.toString(36);
}

function remember(rev, snapshot) {
  history.delete(rev); // re-insert so it counts as recently used
  history.set(rev, snapshot);
  while (history.size > HISTORY_MAX) history.delete(history.keys().next().value);
}

const EMPTY = '{"updated":null,"nextNum":1,"tasks":[]}';

function readTasks(file) {
  let text = EMPTY;
  try {
    if (existsSync(file)) text = readFileSync(file, 'utf8');
  } catch {}
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = JSON.parse(EMPTY); // unparseable on disk: treat as empty rather than 500
  }
  if (!data || !Array.isArray(data.tasks)) data = JSON.parse(EMPTY);
  return { text, data, rev: revOf(text) };
}

// Every task by id, remembering which task it hangs under.
function indexTasks(list, out = new Map(), parent = null) {
  for (const t of list || []) {
    if (t && t.id) out.set(t.id, { task: t, parent });
    if (t && Array.isArray(t.subtasks)) indexTasks(t.subtasks, out, t.id);
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Three-way merge at FIELD granularity, with the INCOMING tree as the
// structural authority: whoever is dragging rows around in the dashboard
// decides the shape, and the disk contributes field values and whole new tasks.
//
// That asymmetry is deliberate. Reordering and re-nesting are whole-tree
// operations with no sensible per-node merge, while what arrives from the file
// side is almost always notes and statuses on tasks that already exist — so
// this keeps the operation each side is actually good at.
//
// Deletions are propagated in NEITHER direction. Resurrecting a task someone
// deleted is a nuisance; deleting one they still had open is data loss, and the
// two are not worth trading.
function mergeTasks(base, disk, incoming) {
  const bi = indexTasks(base.tasks);
  const di = indexTasks(disk.tasks);
  const ii = indexTasks(incoming.tasks);
  let fields = 0;
  let grafted = 0;

  for (const [id, { task }] of ii) {
    const b = bi.get(id)?.task;
    const d = di.get(id)?.task;
    if (!b || !d) continue;
    for (const k of new Set([...Object.keys(b), ...Object.keys(d)])) {
      if (k === 'subtasks') continue; // structure, handled by the tree itself
      // the client left this field alone and the disk changed it -> take disk's
      if (same(task[k], b[k]) && !same(d[k], b[k])) {
        task[k] = d[k];
        fields++;
      }
    }
  }

  for (const [id, { task, parent }] of di) {
    if (ii.has(id) || bi.has(id)) continue; // already here, or deleted by the client
    const host = parent ? ii.get(parent)?.task : null;
    if (host) (host.subtasks || (host.subtasks = [])).push(task);
    else incoming.tasks.push(task);
    grafted++;
  }

  incoming.nextNum = Math.max(Number(incoming.nextNum) || 1, Number(disk.nextNum) || 1);
  return { fields, grafted };
}

export default function tasksDashboardPlugin() {
  return {
    name: 'tasks-dashboard',
    configureServer(server) {
      const tasksFile = () => resolve(server.config.root, 'TASKS.json');

      server.middlewares.use('/tasks', (req, res, next) => {
        // connect prefix-matches (/tasks.json, /tasks/x would land here too) — exact only
        if (req.url !== '/' && req.url !== '') return next();
        try {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readFileSync(resolve(HERE, 'tasks-dashboard.html')));
        } catch (e) {
          res.statusCode = 500;
          res.end('tasks dashboard missing: ' + e.message);
        }
      });

      // Cheap enough to poll: the rev alone, so an open dashboard can notice
      // the file moving under it without pulling the whole document every time.
      server.middlewares.use('/__tasks-rev', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          res.end(JSON.stringify({ rev: readTasks(tasksFile()).rev }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: 'read failed: ' + e.message }));
        }
      });

      server.middlewares.use('/__tasks', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const { data, rev } = readTasks(tasksFile());
          // a copy of its own — the snapshot must not alias anything a merge
          // later mutates, and it has to survive an unparseable file on disk
          remember(rev, JSON.parse(JSON.stringify(data)));
          res.end(JSON.stringify({ ...data, rev }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: 'read failed: ' + e.message }));
        }
      });

      server.middlewares.use('/__save-tasks', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const MAX_BODY = 5 * 1024 * 1024;
        let body = '';
        let tooBig = false;
        req.on('data', (c) => {
          if (tooBig) return;
          body += c;
          if (body.length > MAX_BODY) {
            tooBig = true;
            res.statusCode = 413;
            res.end('{"ok":false,"error":"body too large"}');
            req.destroy();
          }
        });
        req.on('end', () => {
          if (tooBig) return;
          let data;
          try {
            data = JSON.parse(body);
            if (!data || !Array.isArray(data.tasks)) throw new Error('expected {tasks:[...]}');
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'invalid payload: ' + e.message }));
            return;
          }
          try {
            res.setHeader('Content-Type', 'application/json');
            const cur = readTasks(tasksFile());
            const out = { updated: data.updated, nextNum: data.nextNum, tasks: data.tasks };
            let merged = null;

            if (data.baseRev && data.baseRev !== cur.rev) {
              const base = history.get(data.baseRev);
              if (!base) {
                // The base this save started from is older than the history, so
                // there is nothing honest to merge against. Say so and let the
                // client reload rather than overwrite work it cannot see.
                res.statusCode = 409;
                res.end(JSON.stringify({ ok: false, stale: true, rev: cur.rev }));
                return;
              }
              merged = mergeTasks(base, cur.data, out);
            }

            const text = JSON.stringify(out, null, 2) + '\n';
            writeFileSync(tasksFile(), text);
            const rev = revOf(text);
            remember(rev, JSON.parse(JSON.stringify(out)));
            res.statusCode = 200;
            // The merged tree goes back with the receipt: the client's copy is
            // now behind the file it just wrote, and silently leaving it that
            // way is how the next save loses the same edits again.
            res.end(
              JSON.stringify(
                merged
                  ? { ok: true, rev, merged, tasks: out.tasks, nextNum: out.nextNum }
                  : { ok: true, rev }
              )
            );
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: 'write failed: ' + e.message }));
          }
        });
      });
    },
  };
}
