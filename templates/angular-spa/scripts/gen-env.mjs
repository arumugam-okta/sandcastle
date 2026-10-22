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
