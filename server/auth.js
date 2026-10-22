// The hosting platform authenticates users and forwards their identity in a header.
// Locally (RUNTIME != docker) everything runs as a single "local" user.
import crypto from 'node:crypto';

const HEADER = (process.env.AUTH_HEADER || 'x-forwarded-user').toLowerCase();

export const ownerOf = (req) =>
  req.headers[HEADER] || process.env.DEFAULT_USER || (process.env.RUNTIME === 'docker' ? null : 'local');

// Filesystem/container-name safe, collision-resistant id for an owner.
export const ownerSlug = (owner) =>
  owner.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) +
  '-' + crypto.createHash('sha1').update(owner).digest('hex').slice(0, 6);
