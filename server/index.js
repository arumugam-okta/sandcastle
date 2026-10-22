// Control plane: per-user workspaces (one per template), started through a Runtime
// (local child processes, or one Docker container per workspace) and exposed to the launcher UI.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerOf, ownerSlug } from './auth.js';
import { createRuntime } from './runtime/index.js';
import { startGateway } from './gateway.js';
import { createPreviewProxy, PREFIX } from './preview.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(root, 'templates');
const WORKSPACES = process.env.WORKSPACES_DIR || path.join(root, 'workspaces');
// Where the Docker daemon sees WORKSPACES (differs when this server itself runs in a container).
const HOST_WORKSPACES = process.env.HOST_WORKSPACES || WORKSPACES;
const API_PORT = +(process.env.PORT || 4100);
// PREVIEW_MODE=path: single-port hosting. Previews are served under /preview/<template>/ on this port.
const PATH_MODE = process.env.PREVIEW_MODE === 'path';
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const API_HOST = process.env.HOST || (process.env.RUNTIME === 'docker' || PATH_MODE ? '0.0.0.0' : '127.0.0.1');

const runtime = createRuntime();
const app = express();

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const templateIds = () =>
  fs.readdirSync(TEMPLATES).filter((d) => fs.existsSync(path.join(TEMPLATES, d, 'template.json')));
const getTemplate = (id) => {
  if (!templateIds().includes(id)) return null; // also blocks path traversal
  return readJson(path.join(TEMPLATES, id, 'template.json'));
};

const getTemplateSafe = (id) => (templateIds().includes(id) ? getTemplate(id) : null);
const keyForOwner = (owner, t) => `${ownerSlug(owner)}-${t.id}`;
const preview = PATH_MODE
  ? createPreviewProxy({ getTemplate: getTemplateSafe, runtime, ownerOf, keyFor: keyForOwner })
  : null;
if (preview) app.use(PREFIX, (req, res) => { req.url = PREFIX.slice(0, -1) + req.url; preview.web(req, res); });
app.get('/healthz', (_req, res) => res.send('ok'));
app.use(express.json());

// Redirect URI as the user must register it in Okta (path mode: under the hosted app's URL).
const withRedirect = (t) =>
  PATH_MODE ? { ...t, redirectUri: `${PUBLIC_BASE}/preview/${t.id}${new URL(t.redirectUri).pathname}` } : t;

// Identify the caller (platform auth header) and attach their workspace helpers to the request.
app.use('/api', (req, res, next) => {
  const owner = ownerOf(req);
  if (!owner) return res.status(401).json({ error: 'not authenticated' });
  const slug = ownerSlug(owner);
  req.ctx = {
    owner,
    slug,
    userDir: path.join(WORKSPACES, slug),
    wsDir: (tid) => path.join(WORKSPACES, slug, tid),
    key: (tid) => `${slug}-${tid}`,
  };
  next();
});
const keyFor = keyForOwner;

const parseEnv = (file) => {
  const out = {};
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
    }
  return out;
};

// Credentials shared between templates of the same credentialGroup (e.g. all SPAs), per user.
const sharedFile = (ctx) => path.join(ctx.userDir, '.credentials.json');
const readShared = (ctx) => (fs.existsSync(sharedFile(ctx)) ? readJson(sharedFile(ctx)) : {});
const writeShared = (ctx, all) => {
  fs.mkdirSync(ctx.userDir, { recursive: true });
  fs.writeFileSync(sharedFile(ctx), JSON.stringify(all, null, 2), { mode: 0o600 });
};
// Stored value per field: shared group value, then this workspace's .env, then a sibling template's.
const storedValues = (ctx, t) => {
  const env = parseEnv(path.join(ctx.wsDir(t.id), '.env'));
  const shared = (t.credentialGroup && readShared(ctx)[t.credentialGroup]) || {};
  const siblings = t.credentialGroup
    ? templateIds().map(getTemplate).filter((o) => o.id !== t.id && o.credentialGroup === t.credentialGroup)
    : [];
  const fromSibling = (f) => {
    for (const o of siblings) {
      const of = o.env.find((x) => x.name === f.name);
      const v = of && parseEnv(path.join(ctx.wsDir(o.id), '.env'))[of.key];
      if (v) return v;
    }
    return '';
  };
  return Object.fromEntries(t.env.map((f) => [f.key, shared[f.name] || env[f.key] || fromSibling(f)]));
};

// Where to read files from: the user's workspace if created, otherwise the pristine template.
const srcDir = (ctx, tid) => (fs.existsSync(ctx.wsDir(tid)) ? ctx.wsDir(tid) : path.join(TEMPLATES, tid));

// Resolve a user-supplied relative path inside a workspace, refusing escapes and node_modules.
const safePath = (ctx, tid, rel) => {
  const base = ctx.wsDir(tid);
  const full = path.resolve(base, rel);
  if (!full.startsWith(base + path.sep) || full.split(path.sep).includes('node_modules')) return null;
  return full;
};

const HIDDEN = ['node_modules', 'package-lock.json', '.env', 'template.json', '.angular', 'dist'];
const listFiles = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (HIDDEN.includes(e.name) || e.name.endsWith('.generated.ts')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });

app.get('/api/templates', (_req, res) => res.json(templateIds().map(getTemplate).map(withRedirect)));

app.get('/api/workspaces/:id', async (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.sendStatus(404);
  const { ctx } = req;
  const { status, log } = await runtime.state(ctx.key(t.id));
  const values = storedValues(ctx, t);
  // never send secrets back to the browser
  for (const f of t.env) if (f.secret && values[f.key]) values[f.key] = '********';
  res.json({
    exists: fs.existsSync(ctx.wsDir(t.id)),
    status,
    log,
    url: PATH_MODE ? `${PUBLIC_BASE}/preview/${t.id}/` : runtime.previewUrl(t),
    values,
    files: listFiles(srcDir(ctx, t.id)),
  });
});

app.post('/api/workspaces/:id/start', async (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.sendStatus(404);
  const { ctx } = req;
  const key = ctx.key(t.id);
  const { status } = await runtime.state(key);
  if (status === 'running' || status === 'installing') return res.status(409).json({ error: 'already running' });

  const dir = ctx.wsDir(t.id);
  if (!fs.existsSync(dir)) fs.cpSync(path.join(TEMPLATES, t.id), dir, { recursive: true });

  // "********" (or nothing) means "keep the stored value". Saved values also update the shared group.
  const prev = storedValues(ctx, t);
  const next = Object.fromEntries(t.env.map((f) => {
    const v = req.body.values?.[f.key];
    return [f.key, v === undefined || v === '********' ? prev[f.key] : String(v).replace(/[\r\n]/g, '')];
  }));
  if (t.credentialGroup) {
    const all = readShared(ctx);
    all[t.credentialGroup] = { ...all[t.credentialGroup], ...Object.fromEntries(t.env.map((f) => [f.name, next[f.key]])) };
    writeShared(ctx, all);
  }
  fs.writeFileSync(path.join(dir, '.env'), t.env.map((f) => `${f.key}=${next[f.key]}`).join('\n') + '\n', { mode: 0o600 });

  try {
    await runtime.start({
      key, t, dir, owner: ctx.owner, publicBase: PUBLIC_BASE,
      hostDir: path.join(HOST_WORKSPACES, ctx.slug, t.id),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/workspaces/:id/stop', async (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.sendStatus(404);
  await runtime.stop(req.ctx.key(t.id));
  res.json({ ok: true });
});

app.post('/api/workspaces/:id/reset', async (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.sendStatus(404);
  const { ctx } = req;
  const { status } = await runtime.state(ctx.key(t.id));
  if (['running', 'installing'].includes(status)) return res.status(409).json({ error: 'stop it first' });
  await runtime.remove(ctx.key(t.id));
  fs.rmSync(ctx.wsDir(t.id), { recursive: true, force: true });
  res.json({ ok: true });
});

app.get('/api/workspaces/:id/file', (req, res) => {
  const rel = String(req.query.path ?? '');
  if (!getTemplate(req.params.id)) return res.sendStatus(404);
  const { ctx } = req;
  let p = safePath(ctx, req.params.id, rel);
  if (!p || !fs.existsSync(p)) {
    // no workspace yet: serve the template's copy, same traversal rules
    const full = path.resolve(TEMPLATES, req.params.id, rel);
    if (!full.startsWith(path.join(TEMPLATES, req.params.id) + path.sep) || !fs.existsSync(full)) return res.sendStatus(404);
    p = full;
  }
  if (path.basename(p) === '.env') return res.sendStatus(404); // never expose secrets
  res.type('text/plain').send(fs.readFileSync(p, 'utf8'));
});

app.put('/api/workspaces/:id/file', (req, res) => {
  const p = safePath(req.ctx, req.params.id, String(req.query.path ?? ''));
  if (!getTemplate(req.params.id) || !p || path.basename(p) === '.env') return res.sendStatus(400);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, req.body.content ?? '');
  res.json({ ok: true });
});

// Package install backend: a real `npm install <pkg>` inside the workspace (or its container).
app.post('/api/workspaces/:id/install', async (req, res) => {
  const t = getTemplate(req.params.id);
  const { ctx } = req;
  const pkgs = [].concat(req.body.packages ?? []).map(String);
  const valid = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.^~<>=*-]+)?$/;
  if (!t || !fs.existsSync(ctx.wsDir(t.id)) || !pkgs.length || !pkgs.every((p) => valid.test(p)))
    return res.status(400).json({ error: 'bad request' });
  const r = await runtime.install({ key: ctx.key(t.id), dir: ctx.wsDir(t.id) }, pkgs);
  res.status(r.ok ? 200 : 500).json({ output: r.output });
});

// Serve the built launcher if present.
const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

fs.mkdirSync(WORKSPACES, { recursive: true });
const server = app.listen(API_PORT, API_HOST, () =>
  console.log(`Control plane (${runtime.name} runtime) on http://${API_HOST}:${API_PORT}`));

if (preview) server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith(PREFIX)) return socket.destroy();
  preview.upgrade(req, socket, head);
});

// In docker mode the apps are not reachable directly, so the gateway serves each template's port.
const gateways = runtime.name === 'docker'
  ? startGateway({
      templates: templateIds().map(getTemplate), runtime, ownerOf, keyFor,
      host: process.env.GATEWAY_HOST || '0.0.0.0',
    })
  : [];

const shutdown = async () => {
  await runtime.shutdown();
  for (const g of gateways) g.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
