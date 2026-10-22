const express = require('express');
const { auth } = require('express-openid-connect');

const PORT = +(process.env.PORT || 4102);
const BASE_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
// Hosted behind a path-routed preview the routes live under BASE_PATH (e.g. /preview/express-web).
const BASE_PATH = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const app = express();
const router = express.Router();

router.use(auth({
  issuerBaseURL: process.env.OKTA_ISSUER,
  clientID: process.env.OKTA_CLIENT_ID,
  clientSecret: process.env.OKTA_CLIENT_SECRET,
  baseURL: BASE_URL,
  secret: 'local-test-session-secret-change-me-0123456789',
  authRequired: false,
  idpLogout: true,
  authorizationParams: { response_type: 'code', scope: 'openid profile email' },
  routes: { callback: '/callback' },
}));

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>Okta Express</title><style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; font-family: ui-sans-serif, system-ui, sans-serif; background: #f5f6fa; color: #1a1a2e; }
  .card { width: 100%; max-width: 560px; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(20,20,60,.08); }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #4f46e5; background: #eef0ff; padding: 4px 10px; border-radius: 999px; }
  h1 { margin: 12px 0 4px; font-size: 24px; } .muted { color: #6b7280; margin: 0 0 24px; font-size: 14px; }
  .btn { display: inline-block; text-decoration: none; font-weight: 600; padding: 10px 18px; border-radius: 10px; background: #4f46e5; color: #fff; }
  .btn.secondary { background: #eef0ff; color: #4f46e5; }
  .row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .status { display: flex; align-items: center; gap: 8px; font-weight: 600; } .dot { width: 10px; height: 10px; border-radius: 50%; background: #10b981; }
  pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 10px; overflow: auto; font-size: 13px; max-height: 320px; }
</style></head><body><div class="card"><span class="badge">express-openid-connect</span><h1>Okta Express</h1>${body}</div></body></html>`;

router.get('/', (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.send(page(`<p class="muted">You are signed out. Sign in to see the ID token claims.</p>
      <a class="btn" href="${BASE_PATH}/login">Sign in with Okta</a>`));
  }
  const user = req.oidc.user;
  res.send(page(`<div class="row"><span class="status"><span class="dot"></span> Signed in${user.email ? ' as ' + esc(user.email) : ''}</span>
    <a class="btn secondary" href="${BASE_PATH}/logout">Sign out</a></div><pre>${esc(JSON.stringify(user, null, 2))}</pre>`));
});

app.use(BASE_PATH || '/', router);
app.listen(PORT, process.env.HOST || '0.0.0.0', () => console.log(`Listening on http://localhost:${PORT}`));
