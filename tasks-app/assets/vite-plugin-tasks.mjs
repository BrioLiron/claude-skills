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

      server.middlewares.use('/__tasks', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          res.end(existsSync(tasksFile()) ? readFileSync(tasksFile()) : '{"updated":null,"tasks":[]}');
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
            writeFileSync(tasksFile(), JSON.stringify(data, null, 2) + '\n');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: 'write failed: ' + e.message }));
          }
        });
      });
    },
  };
}
