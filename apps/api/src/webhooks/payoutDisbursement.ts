import type { Pool } from "pg";

/** Operational record of a payout-rail instruction for a settlement batch. */
export async function recordPayoutDisbursementEffect(
  pool: Pool,
  settlementBatchId: string,
  amountFils: number,
): Promise<void> {
  if (amountFils <= 0) {
    // Void batches (zero or negative net) carry no payout instruction.
    return;
  }

  // One instruction per batch. This runs on a webhook delivery's first attempt, and a batch has one delivery per
  // subscribed endpoint plus any replays, so an unguarded INSERT disbursed the same payout once for each of them.
  await pool.query(
    `INSERT INTO settlement_payout_disbursements (settlement_batch_id, amount_fils, disbursement_reference)
     SELECT $1, $2, 'disb_' || gen_random_uuid()
      WHERE NOT EXISTS (SELECT 1 FROM settlement_payout_disbursements WHERE settlement_batch_id = $1)`,
    [settlementBatchId, amountFils],
  );
}
