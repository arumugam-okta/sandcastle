// Runs each workspace in its own container from the template's pre-built image
// (okta-tpl-<template>, see scripts/build-templates.sh). Uses the docker CLI, so the only
// requirement is access to a Docker daemon (e.g. a mounted socket).
import { execFile } from 'node:child_process';

const NETWORK = process.env.DOCKER_NETWORK || 'okta-net';
const INTERNAL_PORT = 3000;
const docker = (args) =>
  new Promise((resolve) =>
    execFile('docker', args, { maxBuffer: 16 << 20 }, (err, stdout, stderr) =>
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(stdout) + String(stderr) })));
const cname = (key) => `okta-ws-${key}`;

export class DockerRuntime {
  name = 'docker';
  #networkReady = false;

  async #ensureNetwork() {
    if (this.#networkReady) return;
    if ((await docker(['network', 'inspect', NETWORK])).code !== 0) await docker(['network', 'create', NETWORK]);
    this.#networkReady = true;
  }

  // hostDir is the workspace path as the Docker daemon sees it (differs from our own path
  // when the control plane itself runs in a container).
  async start({ key, t, owner, hostDir }) {
    await this.#ensureNetwork();
    await docker(['rm', '-f', cname(key)]);
    const run = await docker([
      'run', '-d', '--name', cname(key), '--network', NETWORK,
      '--label', 'okta-runner=1', '--label', `okta-owner=${owner}`, '--label', `okta-template=${t.id}`,
      '--memory', process.env.WS_MEMORY || '1g', '--cpus', process.env.WS_CPUS || '1', '--pids-limit', '512',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--user', process.env.WS_USER || `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      '-v', `${hostDir}:/app`,
      '-e', 'HOME=/tmp', '-e', `PORT=${INTERNAL_PORT}`, '-e', 'HOST=0.0.0.0', '-e', `PUBLIC_URL=${this.previewUrl(t)}`,
      `okta-tpl-${t.id}`,
    ]);
    if (run.code !== 0) throw new Error(run.out.trim());
  }

  async stop(key) { await docker(['stop', '-t', '5', cname(key)]); }

  async state(key) {
    const insp = await docker(['inspect', '-f', '{{.State.Status}} {{.State.ExitCode}}', cname(key)]);
    if (insp.code !== 0) return { status: 'stopped', log: [] };
    const [s, exit] = insp.out.trim().split(' ');
    const logs = await docker(['logs', '--tail', '500', cname(key)]);
    const status =
      s === 'running' ? 'running'
      : s === 'exited' ? (exit === '0' || exit === '143' ? 'stopped' : 'error')
      : s === 'created' || s === 'restarting' ? 'installing'
      : 'error';
    return { status, log: logs.out.split('\n').filter(Boolean) };
  }

  async install({ key }, pkgs) {
    const r = await docker(['exec', cname(key), 'npm', 'install', ...pkgs, '--no-audit', '--no-fund']);
    return { ok: r.code === 0, output: r.out };
  }

  async remove(key) { await docker(['rm', '-f', cname(key)]); }
  target(key) { return `http://${cname(key)}:${INTERNAL_PORT}`; }
  previewUrl(t) { return `${process.env.PREVIEW_BASE_URL || 'http://localhost'}:${t.port}`; }
  async shutdown() { /* containers outlive the control plane on purpose */ }
}
