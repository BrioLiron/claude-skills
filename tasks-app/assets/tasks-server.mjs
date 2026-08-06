#!/usr/bin/env node
// Standalone tasks-dashboard server — zero dependencies, Node 16+.
// For projects that don't run a Vite dev server (for those, use
// vite-plugin-tasks.mjs instead — same endpoints, no extra process).
//
//   node tools/tasks-server.mjs [--port 5190]
//
// GET  /tasks (or /)   → the dashboard (tasks-dashboard.html, next to this script)
// GET  /__tasks        → TASKS.json (project root = current working directory)
// POST /__save-tasks   → rewrites TASKS.json pretty-printed
//
// TASKS.json is the single source of truth — the dashboard reorders/edits it,
// and it stays hand- and Claude-readable. Run this from the project root.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DASHBOARD = resolve(HERE, 'tasks-dashboard.html');
const TASKS_FILE = resolve(process.cwd(), 'TASKS.json');

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? Number(process.argv[portArg + 1]) : Number(process.env.TASKS_PORT || 5190);
const MAX_BODY = 5 * 1024 * 1024;

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;

  if (path === '/' || path === '/tasks') {
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(readFileSync(DASHBOARD));
    } catch (e) {
      res.statusCode = 500;
      res.end('tasks dashboard missing: ' + e.message);
    }
    return;
  }

  if (path === '/__tasks') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.end(existsSync(TASKS_FILE) ? readFileSync(TASKS_FILE) : '{"updated":null,"tasks":[]}');
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: 'read failed: ' + e.message }));
    }
    return;
  }

  if (path === '/__save-tasks') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('POST only');
      return;
    }
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
        writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2) + '\n');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: 'write failed: ' + e.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Tasks dashboard → http://localhost:${PORT}/tasks`);
  console.log(`TASKS.json      → ${TASKS_FILE}`);
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE'
    ? `Port ${PORT} is taken — pick another: node tools/tasks-server.mjs --port <n>`
    : e.message);
  process.exit(1);
});
