// The hosting platform authenticates users and forwards their identity in a header.
// On the Okta app platform the gateway stamps the verified email in X-idDB-User-Email.
// Locally (not hosted) everything runs as a single "local" user.
import crypto from 'node:crypto';

const HEADER = (process.env.AUTH_HEADER || 'x-iddb-user-email').toLowerCase();
const HOSTED = process.env.RUNTIME === 'docker' || process.env.PREVIEW_MODE === 'path';

export const ownerOf = (req) =>
  req.headers[HEADER] || process.env.DEFAULT_USER || (HOSTED ? null : 'local');

// Filesystem/container-name safe, collision-resistant id for an owner.
export const ownerSlug = (owner) =>
  owner.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) +
  '-' + crypto.createHash('sha1').update(owner).digest('hex').slice(0, 6);
