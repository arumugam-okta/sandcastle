# Okta SDK test runner

Pick a template (React SPA, Angular SPA, Express web app), enter your Okta test app settings, and run it
as a real app with a live preview. It can be opened in a new tab, so redirect login works.

## Run locally
```sh
npm install
npm run server   # control plane + API on :4100 (local runtime: child processes)
npm run dev      # launcher UI on :5173
```
Open http://localhost:5173, choose a template, add the redirect URI shown to your Okta app, then **Create & run**.
Templates run on 4101 (React), 4102 (Express), 4103 (Angular).

Workspaces and saved credentials live in `workspaces/<user>/` (git-ignored). SPA templates share credentials.

## Hosted (Okta app platform)
One container, one port. The `Dockerfile` builds the launcher and runs the control plane with `PREVIEW_MODE=path`:
each user's template runs as a child process on an internal port and is proxied under `/preview/<template>/`
(WebSockets must be enabled for the app: `apps_set_websockets`). Users come from the gateway's `X-idDB-User-Email`
header (`AUTH_HEADER` to override). Set `PUBLIC_BASE_URL` to the app's URL (no trailing slash); the launcher then shows
redirect URIs like `<PUBLIC_BASE_URL>/preview/react-spa/login/callback` to register in Okta.
Prefer the host-style app URL (`https://<app>.<tenant>.<TLD>`); the previews' absolute paths assume the app is at the root.
Workspaces live in `/data/workspaces` (ephemeral unless a volume is mounted).

## Hosted (Docker, multi-port)
`RUNTIME=docker` runs each workspace in its own container behind per-port gateways (needs a Docker daemon).
See `docker-compose.yml` and `scripts/build-templates.sh`; this mode is untested.

## Add a template
Create `templates/<id>/` with a runnable project and a `template.json` (id, name, port, redirectUri, env fields,
optional `credentialGroup`). It appears in the launcher automatically.

`sandpack.html` is the older in-browser Sandpack snippet mode (needs the Sandpack bundler from codesandbox/sandpack-bundler).
