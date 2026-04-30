import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifySignature } from '@/lib/verify';

// POST /api/webhooks
// Receives an incoming event, verifies the HMAC signature, stores it.
// If storage fails the event is written to the dead_letter_queue so nothing is lost.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  // 1. Verify the signature 
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse the body
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType: string =
    payload !== null &&
    typeof payload === 'object' &&
    'type' in payload &&
    typeof (payload as Record<string, unknown>).type === 'string'
      ? (payload as Record<string, string>).type
      : 'unknown';

  // 3. Store: on failure, store in dead_letter_queue table (error queue)
  try {
    const [event] = await query(
      `INSERT INTO webhook_events (event_type, payload, raw_body, signature)
       VALUES ($1, $2, $3, $4)
       RETURNING id, event_type, received_at`,
      [eventType, JSON.stringify(payload), rawBody, signature]
    );
    return NextResponse.json({ received: true, event }, { status: 201 });
  } catch (err) {
    // Storage failed: write to DLQ (error queue) so the event is stored
    const reason = err instanceof Error ? err.message : String(err);
    try {
      await query(
        `INSERT INTO dead_letter_queue (raw_body, signature, failure_reason)
         VALUES ($1, $2, $3)`,
        [rawBody, signature, reason]
      );
    } catch (dlqErr) {
      // DLQ(error queue) also failed — log and return 500; the caller should retry
      console.error('DLQ write failed:', dlqErr);
    }
    return NextResponse.json({ error: 'Storage failed, event queued for retry' }, { status: 500 });
  }
}

// GET /api/webhooks
// Returns received events, most recent first.
// Supports: ?limit=N (default 50, max 200)
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(limitParam ? parseInt(limitParam, 10) : 50, 200);

  const events = await query(
    `SELECT id, event_type, payload, received_at
     FROM webhook_events
     ORDER BY received_at DESC
     LIMIT $1`,
    [limit]
  );

  return NextResponse.json({ events });
}
