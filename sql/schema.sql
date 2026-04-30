-- Received webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
  id          SERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  raw_body    TEXT NOT NULL,
  signature   TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx  ON webhook_events (event_type);

-- Dead letter queue (error queue) — events that failed to store in webhook_events
-- A background job or manual process can retry these
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id             SERIAL PRIMARY KEY,
  raw_body       TEXT NOT NULL,
  signature      TEXT,
  failure_reason TEXT NOT NULL,
  failed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried_at     TIMESTAMPTZ,
  resolved       BOOLEAN NOT NULL DEFAULT FALSE
);
