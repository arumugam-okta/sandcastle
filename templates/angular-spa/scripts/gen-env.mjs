// Angular's build does not read .env, so turn it into a TS file before `ng serve`.
// (Runs via `node --env-file=.env`, so process.env already holds the values.)
import fs from 'node:fs';

const env = {
  issuer: process.env.OKTA_ISSUER ?? '',
  clientId: process.env.OKTA_CLIENT_ID ?? '',
};
fs.writeFileSync(
  new URL('../src/env.generated.ts', import.meta.url),
  `// generated from .env by scripts/gen-env.mjs — do not edit\nexport const env = ${JSON.stringify(env, null, 2)};\n`
);

// Hosted behind a path-routed preview (BASE_PATH=/preview/angular-spa/), the app's <base href>
// must match the serve path. `ng serve` has no --base-href flag, so rewrite index.html.
const base = process.env.BASE_PATH || '/';
const indexUrl = new URL('../src/index.html', import.meta.url);
fs.writeFileSync(indexUrl, fs.readFileSync(indexUrl, 'utf8').replace(/<base href="[^"]*"/, `<base href="${base}"`));
