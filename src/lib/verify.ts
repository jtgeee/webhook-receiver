import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.WEBHOOK_SECRET ?? 'fluff-secret-abc123';

export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', SECRET)
    .update(rawBody)
    .digest('hex');

  // Normalise — accept both plain hex and "sha256=<hex>" prefixed formats
  const incoming = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(incoming, 'hex'));
  } catch {
    // Buffer.from throws if the incoming string isn't valid hex
    return false;
  }
}
