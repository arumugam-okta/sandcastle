// Runs a workspace as child processes on the host (development mode), or inside the hosted
// container (PREVIEW_MODE=path). In path mode each workspace gets its own internal port and is
// served under /preview/<template>/ by the control plane, with a scrubbed environment so
// user-editable code cannot read the platform's secrets.
import { spawn } from 'node:child_process';

const PATH_MODE = process.env.PREVIEW_MODE === 'path';
const PORT_BASE = +(process.env.PREVIEW_PORT_BASE || 5000);
const KEEP_ENV = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'NODE_OPTIONS', 'npm_config_cache', 'NPM_CONFIG_REGISTRY'];
const baseEnv = () =>
  PATH_MODE ? Object.fromEntries(KEEP_ENV.filter((k) => process.env[k]).map((k) => [k, process.env[k]])) : process.env;

export class LocalRuntime {
  name = 'local';
  procs = new Map(); // key -> { proc, log: string[], status }
  ports = new Map(); // key -> internal port (path mode)

  #log(r, text) {
    r.log.push(...text.toString().split('\n').filter(Boolean));
    if (r.log.length > 500) r.log.splice(0, r.log.length - 500);
  }

  #port(key) {
    if (!this.ports.has(key)) {
      const used = new Set(this.ports.values());
      let p = PORT_BASE;
      while (used.has(p)) p++;
      this.ports.set(key, p);
    }
    return this.ports.get(key);
  }

  #run(r, dir, cmd, args, env) {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { cwd: dir, env });
      proc.stdout.on('data', (d) => this.#log(r, d));
      proc.stderr.on('data', (d) => this.#log(r, d));
      proc.on('close', resolve);
      r.proc = proc;
    });
  }

  async start({ key, t, dir, publicBase }) {
    const r = { proc: null, log: [], status: 'installing' };
    this.procs.set(key, r);
    const runEnv = PATH_MODE
      ? {
          ...baseEnv(),
          PORT: String(this.#port(key)),
          HOST: '127.0.0.1',
          BASE_PATH: `/preview/${t.id}/`,
          PUBLIC_URL: `${publicBase}/preview/${t.id}`,
        }
      : baseEnv();
    (async () => {
      const code = await this.#run(r, dir, 'npm', ['install', '--no-audit', '--no-fund'], baseEnv());
      if (r.status === 'stopping') return void (r.status = 'stopped');
      if (code !== 0) return void (r.status = 'error');
      r.status = 'running';
      const exit = await this.#run(r, dir, 'npm', ['start'], runEnv);
      r.status = r.status === 'stopping' || exit === 0 ? 'stopped' : 'error';
    })();
  }

  async stop(key) {
    const r = this.procs.get(key);
    if (r?.proc) {
      r.status = 'stopping';
      r.proc.kill('SIGTERM');
    }
  }

  async state(key) {
    const r = this.procs.get(key);
    return { status: r?.status ?? 'stopped', log: r?.log ?? [] };
  }

  async install({ dir }, pkgs) {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['install', ...pkgs, '--no-audit', '--no-fund'], { cwd: dir, env: baseEnv() });
      let output = '';
      proc.stdout.on('data', (d) => (output += d));
      proc.stderr.on('data', (d) => (output += d));
      proc.on('close', (code) => resolve({ ok: code === 0, output }));
    });
  }

  async remove(key) { this.procs.delete(key); this.ports.delete(key); }
  // Local dev: apps listen on their own port, no gateway. Path mode: the preview proxy targets this.
  target(key) { return PATH_MODE && this.ports.has(key) ? `http://127.0.0.1:${this.ports.get(key)}` : null; }
  previewUrl(t) { return `http://localhost:${t.port}`; }
  async shutdown() { for (const r of this.procs.values()) r.proc?.kill('SIGTERM'); }
}
