import type { PoolClient } from "pg";
import { toBahrainDateString } from "../bahrainDate.js";

/** Shape of a row read by runConsumerPass's `SELECT ... FROM outbox_events`
 *  — id/created_at are used for bucketing/watermarking,
 *  event_type dispatches, payload is applied as-is (never re-derived from
 *  a join). */
export interface OutboxEventRow {
  id: string | number | bigint;
  event_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

/** node-pg returns jsonb objects, but a double-encoded payload (JSON.stringify
 *  of a string stored in jsonb) comes back as a string. Unwrap that so
 *  merchantId / amountCapturedFils are readable either way. */
function coercePayload(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function payloadMerchantId(payload: Record<string, unknown>): string | undefined {
  const value = payload.merchantId ?? payload.merchant_id;
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * transaction.captured — sums the exact per-event amount_fils delta
 * capture.ts already recorded (payload.amountCapturedFils), never a second
 * aggregation over transactions.captured_fils.
 */
async function applyTransactionCaptured(client: PoolClient, row: OutboxEventRow): Promise<void> {
  const payload = coercePayload(row.payload);
  const nested = coercePayload(payload.data);
  const merchantId = payloadMerchantId(payload) ?? payloadMerchantId(nested);
  const amountCapturedFils = payload.amountCapturedFils ?? payload.amount_captured_fils ?? nested.amountCapturedFils ?? nested.amount_captured_fils;
  // Fixture rows (archive replay tests) insert transaction.captured with
  // payload '{}'. A null merchant_id would stall the whole consumer.
  if (!merchantId || amountCapturedFils == null) {
    return;
  }
  const volumeDate = toBahrainDateString(row.created_at);
  await client.query(
    `INSERT INTO merchant_daily_volume (merchant_id, volume_date, captured_count, captured_gross_fils, last_updated_at)
     VALUES ($1, $2, 1, $3, now())
     ON CONFLICT (merchant_id, volume_date) DO UPDATE
       SET captured_count = merchant_daily_volume.captured_count + 1,
           captured_gross_fils = merchant_daily_volume.captured_gross_fils + EXCLUDED.captured_gross_fils,
           last_updated_at = now()`,
    [merchantId, volumeDate, amountCapturedFils],
  );
}

/**
 * transaction.voided — void.ts's outbox payload is `{ merchantId }` only
 * (no amount), so merchant_daily_volume has no voided_gross_fils column to
 * write to, and it isn't backfilled via an extra join to transactions.
 */
async function applyTransactionVoided(client: PoolClient, row: OutboxEventRow): Promise<void> {
  const payload = coercePayload(row.payload);
  const merchantId = payloadMerchantId(payload) ?? payloadMerchantId(coercePayload(payload.data));
  if (!merchantId) {
    return;
  }
  const volumeDate = toBahrainDateString(row.created_at);
  await client.query(
    `INSERT INTO merchant_daily_volume (merchant_id, volume_date, voided_count, last_updated_at)
     VALUES ($1, $2, 1, now())
     ON CONFLICT (merchant_id, volume_date) DO UPDATE
       SET voided_count = merchant_daily_volume.voided_count + 1,
           last_updated_at = now()`,
    [merchantId, volumeDate],
  );
}

/**
 * refund.succeeded — one refund = one count and its gross amount, bucketed by
 * the Asia/Bahrain date of the event like captures and voids are. Goes through
 * applyDailySummaryRollup so there is a single writer of the refund columns.
 */
async function applySettlementPaid(client: PoolClient, row: OutboxEventRow): Promise<void> {
  const payload = coercePayload(row.payload);
  const merchantId = payloadMerchantId(payload) ?? payloadMerchantId(coercePayload(payload.data));
  const batchId = payload.batchId ?? payload.batch_id;
  if (!merchantId || batchId == null) {
    return;
  }
  await client.query(
    `UPDATE merchant_payout_trends
        SET status = 'paid',
            paid_at = COALESCE(paid_at, now()),
            last_updated_at = now()
      WHERE settlement_batch_id = $1 AND merchant_id = $2`,
    [batchId, merchantId],
  );
}

async function applyRefundSucceeded(client: PoolClient, row: OutboxEventRow): Promise<void> {
  const payload = coercePayload(row.payload);
  const nested = coercePayload(payload.data);
  const merchantId = payloadMerchantId(payload) ?? payloadMerchantId(nested);
  if (!merchantId) {
    return;
  }
  const amountFils = Number(payload.amountFils ?? payload.amount_fils ?? nested.amountFils ?? nested.amount_fils ?? 0);
  await applyDailySummaryRollup(client, merchantId, row.created_at, amountFils);
}

/**
 * Turns a "YYYY-MM-DD" Asia/Bahrain calendar date into the UTC instant that
 * local day starts at. The inverse of bahrainDate.ts's
 * `toBahrainDateString`, and the same fixed-UTC+3 arithmetic (no DST since
 * 1972, so no IANA tzdb/Intl lookup needed) as
 * apps/api/src/settlement/query.ts's function of the same name — each
 * service keeps its own copy, matching how `withTransaction.ts` and
 * `bahrainDate.ts` already live in this directory rather than being shared
 * across packages.
 */
function bahrainLocalMidnightUtc(dateStr: string): Date {
  const parsed = new Date(`${dateStr}T00:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`bahrainLocalMidnightUtc: invalid date "${dateStr}"`);
  }
  return parsed;
}

/**
 * settlement.batch_closed — a single-row lookup against settlement_batches
 * by id (not a fan-out join), capturing whatever
 * status/paid_at it carries at the moment this event is applied. A missing
 * batch row (only possible for a hand-constructed test event — CloseBatch
 * always inserts the row in the same transaction it enqueues this event
 * from) is a no-op, never a thrown error that would poison the whole pass.
 *
 * `ON CONFLICT ... DO UPDATE` (never DO NOTHING) makes this function safe
 * to re-invoke idempotently — required by the `rebuild` subcommand's full
 * replay (cli/rebuild.ts), which calls this exact same function.
 */
async function applyBatchClosed(client: PoolClient, row: OutboxEventRow): Promise<void> {
  const payload = coercePayload(row.payload);
  const nested = coercePayload(payload.data);
  const merchantId = payloadMerchantId(payload) ?? payloadMerchantId(nested);
  const batchId = payload.batchId ?? payload.batch_id ?? nested.batchId ?? nested.batch_id;
  if (!merchantId || batchId == null) {
    return;
  }
  const batchDate = payload.batchDate ?? payload.batch_date;
  const grossFils = payload.grossFils ?? payload.gross_fils;
  const feeFils = payload.feeFils ?? payload.fee_fils;
  const netPayoutFils = payload.netPayoutFils ?? payload.net_payout_fils;
  const refundFils = payload.refundFils ?? payload.refund_fils;
  const refundFeeReversedFils = payload.refundFeeReversedFils ?? payload.refund_fee_reversed_fils;

  const batchResult = await client.query<{ status: string; paid_at: Date | null }>(
    `SELECT status, paid_at FROM settlement_batches WHERE id = $1`,
    [batchId],
  );
  const batch = batchResult.rows[0];
  if (!batch) return;

  await client.query(
    `INSERT INTO merchant_payout_trends
        (merchant_id, settlement_batch_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, paid_at,
         refund_fils, refund_fee_reversed_fils, last_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (merchant_id, settlement_batch_id) DO UPDATE
       SET status = EXCLUDED.status, gross_fils = EXCLUDED.gross_fils,
           fee_fils = EXCLUDED.fee_fils, net_payout_fils = EXCLUDED.net_payout_fils,
           paid_at = EXCLUDED.paid_at,
           refund_fils = EXCLUDED.refund_fils,
           refund_fee_reversed_fils = EXCLUDED.refund_fee_reversed_fils,
           last_updated_at = now()`,
    [
      merchantId,
      batchId,
      batchDate,
      batch.status,
      grossFils,
      feeFils,
      netPayoutFils,
      batch.paid_at,
      refundFils ?? 0,
      refundFeeReversedFils ?? 0,
    ],
  );

  // Rollup parity check: a batch closing is a convenient checkpoint to
  // confirm reporting's own daily-volume rollup actually reflects that
  // day's real capture activity (transaction_events is ground truth,
  // unaffected by outbox consumption order). Catches a stuck-consumer /
  // lost-notification class of problem early, rather than letting a
  // silently-stale rollup go unnoticed until a merchant asks why their
  // dashboard total looks low. Skipped entirely on a day with no real
  // capture activity (an ordinary empty batch, per CloseBatch's own
  // "every merchant gets a batch every day, even at zero" behaviour).
  const windowStart = bahrainLocalMidnightUtc(String(batchDate));
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  const groundTruth = await client.query<{ event_count: string }>(
    `SELECT COUNT(*)::text AS event_count
       FROM transaction_events te
       JOIN transactions t ON t.id = te.transaction_id
      WHERE t.merchant_id = $1
        AND te.event_type IN ('captured', 'partially_captured')
        AND te.occurred_at >= $2 AND te.occurred_at < $3`,
    [merchantId, windowStart, windowEnd],
  );
  const groundTruthCount = Number(groundTruth.rows[0]?.event_count ?? "0");

  if (groundTruthCount > 0) {
    const rollupResult = await client.query(
      `SELECT captured_count FROM merchant_daily_volume WHERE merchant_id = $1 AND volume_date = $2`,
      [merchantId, batchDate],
    );
    // No rollup row at all means the consumer has not reached that day's captures yet: lagging, not a crash
    // (a TypeError here would roll back the whole pass and stall the watermark).
    const rollupCount = (rollupResult.rows[0] as { captured_count: number } | undefined)?.captured_count ?? 0;
    if (rollupCount < groundTruthCount) {
      console.warn(
        `reporting rollup lags ground truth for merchant ${merchantId} on ${batchDate}: ` +
          `rollup=${rollupCount} ground_truth=${groundTruthCount}`,
      );
    }
  }
}


/**
 * Rolls up a running daily refund summary, keyed by Asia/Bahrain calendar
 * date (the same bucketing as every other merchant_daily_volume column, so a
 * refund made at 01:00 Bahrain time lands on that day, not the previous UTC
 * day). Called for each "refund.succeeded" outbox event.
 */
export async function applyDailySummaryRollup(
  client: PoolClient,
  merchantId: string,
  occurredAt: Date,
  amountFils: number,
): Promise<void> {
  const summaryDate = toBahrainDateString(occurredAt);
  await client.query(
    `INSERT INTO merchant_daily_volume (merchant_id, volume_date, refund_count, refund_gross_fils, last_updated_at)
     VALUES ($1, $2, 1, $3, now())
     ON CONFLICT (merchant_id, volume_date) DO UPDATE
       SET refund_count = merchant_daily_volume.refund_count + 1,
           refund_gross_fils = merchant_daily_volume.refund_gross_fils + EXCLUDED.refund_gross_fils,
           last_updated_at = now()`,
    [merchantId, summaryDate, amountFils],
  );
}

/**
 * Dispatches one outbox_events row to the applier for its event_type. The
 * `default` branch exists only so a future EventType addition not yet
 * wired into this switch fails loudly (a thrown error rolls back the whole
 * pass, per runConsumerPass's transactional discipline) rather than
 * silently dropping the event — runConsumerPass's own SELECT already
 * filters to the types handled below, so this branch should never
 * actually run against real data.
 */
export async function applyEvent(client: PoolClient, row: OutboxEventRow): Promise<void> {
  switch (row.event_type) {
    case "transaction.captured":
      return applyTransactionCaptured(client, row);
    case "transaction.voided":
      return applyTransactionVoided(client, row);
    case "settlement.batch_closed":
      return applyBatchClosed(client, row);
    case "refund.succeeded":
      return applyRefundSucceeded(client, row);
    case "settlement.paid":
      return applySettlementPaid(client, row);
    default:
      throw new Error(`applyEvent: unhandled event_type ${row.event_type}`);
  }
}
