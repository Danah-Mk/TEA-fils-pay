import type { Pool } from "pg";
import type { Fils } from "@filspay/money";
import type { AcquirerSimulator } from "../acquirer/types.js";
import type { MerchantAuthContext, MerchantWriterActor } from "../auth/requireMerchantAuth.js";
import { processRefund, type ProcessRefundResult } from "../payments/processRefund.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

/**
 * `POST /v1/refunds` business logic. The merchant always comes from the
 * authenticated session or API key (routes/refunds.ts), never from the path
 * or body; the refund target (`transactionId`) is in the body.
 */

/**
 * The path-scope check the route performs before this module's work begins —
 * the same shape `routes/paymentLinks.ts`'s `assertOwnMerchant` has, lifted
 * out so it is testable without a live route.
 */
export function assertRefundRequestScope(auth: MerchantAuthContext, merchantIdParam: string): void {
  if (auth.merchantId !== merchantIdParam) {
    throw new ForbiddenError("forbidden");
  }
}

export interface InitiateMerchantRefundInput {
  /** From the path, already scope-checked against the session above. */
  merchantId: string;
  /** From the body. */
  transactionId: string;
  amountFils?: Fils;
  idempotencyKey: string;
  actor: MerchantWriterActor;
  reason?: string;
}

/**
 * Refunds can be put on hold per merchant — e.g. while a chargeback-rate
 * spike is under review, or during a compliance hold — via
 * `merchants.refunds_enabled`. A merchant with no hold in place (the
 * default, unset state) is unaffected by this check.
 */
async function assertRefundsNotOnHold(pool: Pool, merchantId: string): Promise<void> {
  const result = await pool.query<{ refunds_enabled: boolean | null }>(
    `SELECT refunds_enabled FROM merchants WHERE id = $1`,
    [merchantId],
  );
  const merchant = result.rows[0];
  if (merchant && merchant.refunds_enabled === false) {
    throw new ForbiddenError("refunds_on_hold");
  }
}

export async function initiateMerchantRefund(
  pool: Pool,
  acquirer: AcquirerSimulator,
  input: InitiateMerchantRefundInput,
): Promise<ProcessRefundResult> {
  await assertRefundsNotOnHold(pool, input.merchantId);

  // Scoped to the caller's own merchant: another merchant's transaction id
  // must answer exactly like a missing one (404), never be refunded on the
  // caller's behalf.
  const result = await pool.query<{ id: string; merchant_id: string }>(
    `SELECT id, merchant_id FROM transactions WHERE id = $1 AND merchant_id = $2`,
    [input.transactionId, input.merchantId],
  );
  const txn = result.rows[0];
  if (!txn) {
    throw new NotFoundError("transaction_not_found");
  }

  return processRefund(pool, acquirer, {
    transactionId: txn.id,
    merchantId: txn.merchant_id,
    amountFils: input.amountFils,
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    reason: input.reason,
  });
}
