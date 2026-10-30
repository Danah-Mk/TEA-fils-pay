-- FP-212 refunds: the columns settlement and reporting need to carry them.
--
-- settlement_batches: gross_fils / fee_fils stay what they always were - the
-- CAPTURED gross and the MDR charged on it. A batch that also absorbs refunds
-- records them next to those, and
--     net_payout_fils = gross_fils - fee_fils - refund_fils + refund_fee_reversed_fils
-- so a refund returns the gross to the cardholder and gives back the share of
-- MDR that was charged on it. Batches closed before this migration have both
-- columns at 0 and keep net = gross - fee.
ALTER TABLE settlement_batches
    ADD COLUMN refund_fils              BIGINT NOT NULL DEFAULT 0 CHECK (refund_fils >= 0),
    ADD COLUMN refund_fee_reversed_fils BIGINT NOT NULL DEFAULT 0 CHECK (refund_fee_reversed_fils >= 0);

-- Backs "which refunds did this batch absorb" (batch detail, reconciliation).
CREATE INDEX idx_refunds_settlement_batch ON refunds (settlement_batch_id)
    WHERE settlement_batch_id IS NOT NULL;

-- apps/reporting's daily rollup: refunds, bucketed by Asia/Bahrain date like
-- captures and voids. (applyDailySummaryRollup already wrote these two
-- columns, which did not exist.)
ALTER TABLE merchant_daily_volume
    ADD COLUMN refund_count      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN refund_gross_fils BIGINT  NOT NULL DEFAULT 0;

-- The payout-trend copy of a batch carries its refund figures too, so
-- gross - fee - refund + fee_reversed = net holds on the chart as well.
ALTER TABLE merchant_payout_trends
    ADD COLUMN refund_fils              BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN refund_fee_reversed_fils BIGINT NOT NULL DEFAULT 0;
