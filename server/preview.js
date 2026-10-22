// Path-routed previews for hosts that expose a single HTTP port (PREVIEW_MODE=path).
// /preview/<template>/... is proxied to the calling user's workspace process, which serves
// itself under that base path. The user comes from the platform's auth header.
import httpProxy from 'http-proxy';

const page = (msg) =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;color:#555"><p>${msg}</p>`;

export const PREFIX = '/preview/';

export function createPreviewProxy({ getTemplate, runtime, ownerOf, keyFor }) {
  const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });

  const targetFor = (req) => {
    const m = /^\/preview\/([^/?#]+)/.exec(req.url);
    const t = m && getTemplate(m[1]);
    const owner = t && ownerOf(req);
    return owner ? runtime.target(keyFor(owner, t)) : null;
  };

  return {
    web(req, res) {
      const fail = (code, msg) => {
        if (!res.headersSent) res.writeHead(code, { 'content-type': 'text/html' });
        res.end(page(msg));
      };
      const target = targetFor(req);
      if (!target) return fail(404, 'Workspace is not running. Start it from the launcher, then reload.');
      proxy.web(req, res, { target }, () => fail(502, 'Workspace is not ready yet. Check the Logs tab, then reload.'));
    },
    upgrade(req, socket, head) {
      const target = targetFor(req);
      // Logged because the platform gateway may not stamp the identity header on WebSocket upgrades.
      console.log(`ws upgrade ${req.url} user-header=${ownerOf(req) ? 'present' : 'missing'} target=${target ?? 'none'}`);
      if (!target) return socket.destroy();
      proxy.ws(req, socket, head, { target }, () => socket.destroy());
    },
  };
}
