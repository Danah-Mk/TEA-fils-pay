-- Session bypass: live_sessions must only expose OTP-verified sessions (0012).
CREATE OR REPLACE VIEW live_sessions AS
SELECT id,
       merchant_user_id,
       token_hash,
       authenticated,
       created_at,
       expires_at
  FROM sessions
 WHERE revoked_at IS NULL
   AND expires_at > now()
   AND authenticated = true;

-- FP-201: first-write wins on acquirer callback ids.
CREATE TABLE IF NOT EXISTS processed_events (
  callback_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DELETE FROM acquirer_callback_notes a
 USING acquirer_callback_notes b
 WHERE a.callback_id = b.callback_id
   AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS acquirer_callback_notes_callback_id_uq
  ON acquirer_callback_notes (callback_id);

-- One settlement.paid outbox row per batch (incident 2026-08-21).
CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_settlement_paid_aggregate_uq
  ON outbox_events (aggregate_id)
  WHERE event_type = 'settlement.paid';

DELETE FROM settlement_payout_disbursements a
 USING settlement_payout_disbursements b
 WHERE a.settlement_batch_id = b.settlement_batch_id
   AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS settlement_payout_disbursements_batch_uq
  ON settlement_payout_disbursements (settlement_batch_id);

-- ADR-0001: platform volume is fils, not a 32-bit BD counter.
ALTER TABLE platform_stats
  ALTER COLUMN total_processed_fils TYPE BIGINT;

ALTER TABLE merchants
  ALTER COLUMN lifetime_net_payout_monitoring_estimate TYPE BIGINT
  USING round(lifetime_net_payout_monitoring_estimate)::bigint;
