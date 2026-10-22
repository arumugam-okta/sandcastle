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

## Hosted (Docker)
`RUNTIME=docker` runs each user's workspace in its own container (`okta-tpl-<id>` images) behind a
per-port gateway; the user comes from the platform's auth header (`AUTH_HEADER`, default `x-forwarded-user`).
```sh
npm run build:templates   # set NPM_REGISTRY for an internal mirror
docker compose up --build
```

## Add a template
Create `templates/<id>/` with a runnable project and a `template.json` (id, name, port, redirectUri, env fields,
optional `credentialGroup`). It appears in the launcher automatically.

`sandpack.html` is the older in-browser Sandpack snippet mode (needs the Sandpack bundler from codesandbox/sandpack-bundler).
