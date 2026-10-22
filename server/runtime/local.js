// Runs a workspace as child processes on the host (development mode).
import { spawn } from 'node:child_process';

export class LocalRuntime {
  name = 'local';
  procs = new Map(); // key -> { proc, log: string[], status }

  #log(r, text) {
    r.log.push(...text.toString().split('\n').filter(Boolean));
    if (r.log.length > 500) r.log.splice(0, r.log.length - 500);
  }

  #run(r, dir, cmd, args) {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { cwd: dir, env: process.env });
      proc.stdout.on('data', (d) => this.#log(r, d));
      proc.stderr.on('data', (d) => this.#log(r, d));
      proc.on('close', resolve);
      r.proc = proc;
    });
  }

  async start({ key, dir }) {
    const r = { proc: null, log: [], status: 'installing' };
    this.procs.set(key, r);
    (async () => {
      const code = await this.#run(r, dir, 'npm', ['install', '--no-audit', '--no-fund']);
      if (r.status === 'stopping') return void (r.status = 'stopped');
      if (code !== 0) return void (r.status = 'error');
      r.status = 'running';
      const exit = await this.#run(r, dir, 'npm', ['start']);
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
      const proc = spawn('npm', ['install', ...pkgs, '--no-audit', '--no-fund'], { cwd: dir });
      let output = '';
      proc.stdout.on('data', (d) => (output += d));
      proc.stderr.on('data', (d) => (output += d));
      proc.on('close', (code) => resolve({ ok: code === 0, output }));
    });
  }

  async remove(key) { this.procs.delete(key); }
  target() { return null; } // apps listen on their own port; no gateway needed
  previewUrl(t) { return `http://localhost:${t.port}`; }
  async shutdown() { for (const r of this.procs.values()) r.proc?.kill('SIGTERM'); }
}
