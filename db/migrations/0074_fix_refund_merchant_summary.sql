-- 0072 joined `transactions t ON t.id = r.id` (a refund id is never a
-- transaction id), so the view was always empty, and it summed
-- t.captured_fils once per refund, double-counting a transaction refunded
-- twice. Rebuilt with the right join and each transaction's captured amount
-- counted once per merchant-day.
DROP MATERIALIZED VIEW IF EXISTS refund_merchant_summary;

CREATE MATERIALIZED VIEW refund_merchant_summary AS
WITH ranked AS (
    SELECT
        r.merchant_id,
        date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain') AS business_date,
        r.amount_fils,
        r.fee_reversed_fils,
        t.captured_fils,
        row_number() OVER (
            PARTITION BY r.merchant_id,
                         date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain'),
                         r.transaction_id
            ORDER BY r.occurred_at, r.id
        ) AS nth_for_transaction
    FROM refunds r
    JOIN transactions t ON t.id = r.transaction_id
    WHERE r.status = 'succeeded'
)
SELECT
    merchant_id,
    business_date,
    COUNT(*)                                                   AS refund_count,
    SUM(amount_fils)                                           AS total_refunded_fils,
    SUM(fee_reversed_fils)                                     AS total_fee_reversed_fils,
    SUM(captured_fils) FILTER (WHERE nth_for_transaction = 1)  AS original_captured_fils
FROM ranked
GROUP BY merchant_id, business_date;

CREATE UNIQUE INDEX idx_refund_merchant_summary_pk
    ON refund_merchant_summary (merchant_id, business_date);
