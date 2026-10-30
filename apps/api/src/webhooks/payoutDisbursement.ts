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

  // PayoutBatch writes this row in the same transaction as the ledger legs.
  // This call is the backfill for deliveries of batches paid before that
  // change, and for any path that still notifies without going through Go.
  // One instruction per batch: unguarded INSERT used to fire once per
  // subscribed endpoint plus replays.
  await pool.query(
    `INSERT INTO settlement_payout_disbursements (settlement_batch_id, amount_fils, disbursement_reference)
     SELECT $1, $2, 'disb_' || gen_random_uuid()
      WHERE NOT EXISTS (SELECT 1 FROM settlement_payout_disbursements WHERE settlement_batch_id = $1)`,
    [settlementBatchId, amountFils],
  );
}
