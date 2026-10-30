import { ZERO_FILS, compareFils, type Fils } from "@filspay/money";

/**
 * The `transactions.status` a row should carry once a refund has been
 * applied to it.
 *
 * Status on this platform is derived from the money columns rather than
 * transitioned by hand: `capture.ts` computes it from `captured_fils` against
 * `amount_fils` at the end of every capture, and this is the same idea for
 * the refund side. Deriving it keeps the status and the amounts from ever
 * disagreeing, and keeps the rule in one readable, testable place instead of
 * spread across the endpoints that happen to write the column.
 */

/**
 * "refunded" means refunded_fils === captured_fils; "partially_refunded"
 * means 0 < refunded_fils < captured_fils. A transaction is never left in a
 * capture status once its full captured amount has been returned.
 */
export type PostRefundStatus = "captured" | "partially_captured" | "partially_refunded" | "refunded";

export interface PostRefundStatusInput {
  /** The authorized amount. */
  amountFils: Fils;
  capturedFils: Fils;
  /** The refunded total *after* the refund being applied, not the delta. */
  refundedTotalFils: Fils;
}

// Huda's rule from the finance call (Sep): "a transaction is refunded when every fils we
// captured went back". The status follows the refunded total against what was CAPTURED, not
// against what was authorized, so a partially captured transaction whose captured amount has
// been returned is `refunded` like any other.
//
// Trade-off, flagged for finance: once the row leaves the capture statuses nothing can capture
// the rest of the authorization, so processRefund releases the leftover hold at the same time.
// (The earlier rule kept `partially_captured` after a full refund to preserve that headroom; it
// made the status disagree with the money and hid fully-returned transactions from refund and
// reporting filters.)
export function nextStatusAfterRefund(input: PostRefundStatusInput): PostRefundStatus {
  if (compareFils(input.refundedTotalFils, ZERO_FILS) === 0) {
    return compareFils(input.capturedFils, input.amountFils) < 0 ? "partially_captured" : "captured";
  }
  if (compareFils(input.refundedTotalFils, input.capturedFils) < 0) {
    return "partially_refunded";
  }
  return "refunded";
}
