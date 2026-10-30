import { useRef, useState } from "react";
import { request } from "../../api/client.js";
import { describeError } from "../../api/client.js";
import { newIdempotencyKey } from "../../utils/helpers.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { bhd } from "../../format.js";
import type { TransactionDto } from "../../types.js";

interface RefundResponse {
  id: string;
  transactionId: string;
  amountFils: number;
  feeReversedFils: number;
  status: string;
  transactionStatus: string;
  refundedTotalFils: number;
  occurredAt: string;
}

interface RefundDrawerProps {
  txn: TransactionDto;
  onRefunded: () => Promise<void>;
}

/**
 * Refund control for a captured transaction (FP-212), posting to
 * `POST /v1/refunds`. Shown to owner/finance, the same roles the server
 * accepts.
 *
 * Idempotency: one key per refund ATTEMPT, not per click. A retry of the same
 * request (network error, double click, timeout) reuses the key, so the
 * server replays instead of refunding twice. The key is dropped when the
 * amount changes (a different request) or the refund succeeds.
 */
export function RefundDrawer({ txn, onRefunded }: RefundDrawerProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptKey = useRef<string | null>(null);

  // What can still go back: captured minus already refunded. A partially
  // refunded transaction stays refundable until nothing is left.
  const refundableFils = txn.capturedFils - txn.refundedFils;
  const refundable =
    (txn.status === "captured" || txn.status === "partially_captured" || txn.status === "partially_refunded") &&
    refundableFils > 0;

  async function handleRefund(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!window.confirm("Refund this transaction? The money goes back to the cardholder and cannot be recalled.")) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const trimmed = amount.trim();
      // Left blank, amountFils is omitted entirely and the API refunds
      // everything still refundable — its own documented default, same
      // affordance the capture form has.
      const body = trimmed === "" ? { transactionId: txn.id } : { transactionId: txn.id, amountFils: Number(trimmed) };
      attemptKey.current ??= newIdempotencyKey();

      await request<RefundResponse>("/v1/refunds", {
        method: "POST",
        headers: { "Idempotency-Key": attemptKey.current },
        body: JSON.stringify(body),
      });

      attemptKey.current = null;
      setOpen(false);
      setAmount("");
      // Refetch rather than patch: the refund wrote a new transaction_events
      // row server-side, so the timeline is stale, not merely shorter.
      await onRefunded();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!refundable) return null;

  return (
    <RequireRole allow={["owner", "finance"]}>
      <div className="dash-actions">
        {error ? <p className="dash-error">{error}</p> : null}
        {open ? (
          <form className="dash-form dash-form-inline" onSubmit={(e) => void handleRefund(e)}>
            <label>
              Amount in fils (blank refunds everything still refundable)
              <input
                type="number"
                min={1}
                step={1}
                max={refundableFils}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  attemptKey.current = null; // a different request needs a different key
                }}
              />
            </label>
            <p className="dash-muted">Still refundable: {bhd(refundableFils)}</p>
            <button type="submit" className="dash-button" disabled={submitting}>
              {submitting ? "Refunding..." : "Refund"}
            </button>
            <button type="button" className="dash-button" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className="dash-button" onClick={() => setOpen(true)}>
            Refund
          </button>
        )}
      </div>
    </RequireRole>
  );
}
