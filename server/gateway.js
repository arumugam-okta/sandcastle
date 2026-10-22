// One listener per template port (so the Okta redirect URIs stay fixed). Each request is
// proxied to the container of the calling user's workspace for that template. The user comes
// from the platform's auth header, so no cookies are involved.
import http from 'node:http';
import httpProxy from 'http-proxy';

const page = (msg) =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;color:#555"><p>${msg}</p>`;

export function startGateway({ templates, runtime, ownerOf, keyFor, host }) {
  const proxy = httpProxy.createProxyServer({ ws: true });
  const targetFor = (req, t) => {
    const owner = ownerOf(req);
    return owner ? runtime.target(keyFor(owner, t)) : null;
  };

  return templates.map((t) => {
    const server = http.createServer((req, res) => {
      const fail = (code, msg) => {
        if (!res.headersSent) res.writeHead(code, { 'content-type': 'text/html' });
        res.end(page(msg));
      };
      const target = targetFor(req, t);
      if (!target) return fail(401, 'Not signed in.');
      proxy.web(req, res, { target }, () => fail(502, 'Workspace is not running yet. Start it from the launcher, then reload.'));
    });
    server.on('upgrade', (req, socket, head) => {
      const target = targetFor(req, t);
      if (!target) return socket.destroy();
      proxy.ws(req, socket, head, { target }, () => socket.destroy());
    });
    server.listen(t.port, host, () => console.log(`Gateway for ${t.id} on :${t.port}`));
    return server;
  });
}
