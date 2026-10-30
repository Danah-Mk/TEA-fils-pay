import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { formatBhd, toFils } from "@filspay/money";
import { getPaymentLink, payPaymentLink } from "../../api/paymentLinks.js";
import { ApiError } from "../../api/client.js";
import { formatCardBrandHint, newIdempotencyKey } from "../../utils/helpers.js";
import type { PaymentLinkPublicDto, PayPaymentLinkResponse, SimulatedCardInput } from "../../types.js";
import "./CheckoutPage.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "loaded"; link: PaymentLinkPublicDto };

type PayState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; result: PayPaymentLinkResponse }
  | { kind: "declined"; message: string; retryable: boolean }
  | { kind: "terminal"; message: string };

const EMPTY_CARD: SimulatedCardInput = { pan: "", expiryMonth: 0, expiryYear: 0, cvv: "" };

function groupPan(value: string): string {
  return value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function shell(children: ReactNode): ReactElement {
  return (
    <div className="checkout-shell">
      <main className="checkout-page">{children}</main>
    </div>
  );
}

export function CheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [payState, setPayState] = useState<PayState>({ kind: "idle" });
  const [card, setCard] = useState<SimulatedCardInput>(EMPTY_CARD);
  const [brandHint, setBrandHint] = useState<string | null>(null);

  // FH: memory leak — this effect never aborts the fetch on unmount (React warning in console?)
  // theres a cancelled flag in the cleanup tho. warning must be from somewhere else — am
  useEffect(() => {
    if (!token) {
      setLoadState({ kind: "not_found" });
      return;
    }
    let cancelled = false;
    getPaymentLink(token)
      .then((link) => {
        if (!cancelled) setLoadState({ kind: "loaded", link });
      })
      .catch(() => {
        // Never distinguishes "malformed token" from "doesn't exist" —
        // matches the API's own non-disclosure choice.
        if (!cancelled) setLoadState({ kind: "not_found" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!token) return;

    // A fresh Idempotency-Key per explicit user action — every click,
    // including a "try again" after a decline, is a new attempt.
    const idempotencyKey = newIdempotencyKey();
    const submittedAt = new Date().toISOString();
    setPayState({ kind: "submitting" });

    try {
      const payload = {
        card: { ...card, pan: card.pan.replace(/\D/g, ""), cvv: card.cvv.replace(/\D/g, "") },
        submittedAt,
      };
      const result = await payPaymentLink(token, payload, idempotencyKey);
      setPayState({ kind: "success", result });
    } catch (err) {
      if (err instanceof ApiError) {
        const { statusCode, body } = err;
        if (statusCode === 402) {
          const stageLabel = body.stage === "capture" ? "Your payment could not be completed." : "Your card was declined.";
          setPayState({ kind: "declined", message: stageLabel, retryable: true });
        } else if (statusCode === 502) {
          setPayState({ kind: "declined", message: "The acquirer is temporarily unavailable. Please try again.", retryable: true });
        } else if (statusCode === 409 && body.error === "payment_link_already_paid") {
          setPayState({ kind: "terminal", message: "This invoice has already been paid." });
        } else if (statusCode === 409 && body.error === "payment_link_canceled") {
          setPayState({ kind: "terminal", message: "This payment link is no longer available." });
        } else if (statusCode === 409) {
          setPayState({ kind: "declined", message: "A payment is already being processed for this link. Please try again shortly.", retryable: true });
        } else if (statusCode === 410) {
          setPayState({ kind: "terminal", message: "This payment link has expired." });
        } else {
          setPayState({ kind: "declined", message: body.message ?? "Something went wrong. Please try again.", retryable: true });
        }
      } else {
        setPayState({ kind: "declined", message: "Something went wrong. Please try again.", retryable: true });
      }
    }
  }

  if (loadState.kind === "loading") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Preparing checkout</h1>
          <p>Fetching this payment link.</p>
        </div>
      </>,
    );
  }

  if (loadState.kind === "not_found") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Link not found</h1>
          <p>This payment link does not exist. Ask the shop for a new one.</p>
        </div>
      </>,
    );
  }

  const { link } = loadState;
  const amount = formatBhd(toFils(link.amountFils));

  if (payState.kind === "success") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <h1>Payment received</h1>
        <p className="checkout-shop">{link.merchantDisplayName}</p>
        <p className="checkout-amount">
          {amount} <span>BHD</span>
        </p>
        <dl className="checkout-receipt">
          <dt>Transaction</dt>
          <dd>{payState.result.transactionId}</dd>
          <dt>Paid at</dt>
          <dd>{new Date(payState.result.paidAt).toLocaleString()}</dd>
          {link.reference ? (
            <>
              <dt>Reference</dt>
              <dd>{link.reference}</dd>
            </>
          ) : null}
        </dl>
      </>,
    );
  }

  if (payState.kind === "terminal") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Unable to pay</h1>
          <p>{payState.message}</p>
        </div>
      </>,
    );
  }

  if (link.status === "paid") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Already paid</h1>
          <p>This invoice has already been paid. No further charge will be taken.</p>
        </div>
      </>,
    );
  }
  if (link.status === "expired") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Link expired</h1>
          <p>Ask the shop for a new payment link.</p>
        </div>
      </>,
    );
  }
  if (link.status === "canceled") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>No longer available</h1>
          <p>This payment link was canceled.</p>
        </div>
      </>,
    );
  }
  if (link.status === "processing") {
    return shell(
      <>
        <p className="checkout-kicker">FilsPay</p>
        <div className="checkout-state">
          <h1>Payment processing</h1>
          <p>A payment is already in progress. Refresh in a moment.</p>
        </div>
      </>,
    );
  }

  const submitting = payState.kind === "submitting";

  return shell(
    <>
      <p className="checkout-kicker">FilsPay</p>
      <p className="checkout-shop">{link.merchantDisplayName}</p>
      <p className="checkout-amount">
        {amount} <span>BHD</span>
      </p>
      {link.description ? <p className="checkout-description">{link.description}</p> : null}
      {link.reference ? <p className="checkout-reference">Reference {link.reference}</p> : null}

      {payState.kind === "declined" ? <p className="checkout-error">{payState.message}</p> : null}

      <form onSubmit={handleSubmit} className="checkout-form">
        <label>
          Card number
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            placeholder="ACCT-000015"
            value={groupPan(card.pan)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
              setCard({ ...card, pan: digits });
              setBrandHint(digits.length >= 4 ? formatCardBrandHint(digits) : null);
            }}
          />
          {brandHint && brandHint !== "unknown" ? (
            <span className="checkout-brand-hint">{brandHint}</span>
          ) : null}
        </label>
        <div className="checkout-form-row">
          <label>
            Month
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={2}
              placeholder="12"
              autoComplete="cc-exp-month"
              value={card.expiryMonth || ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, "").slice(0, 2));
                setCard({ ...card, expiryMonth: Number.isFinite(n) ? n : 0 });
              }}
            />
          </label>
          <label>
            Year
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={4}
              placeholder="2030"
              autoComplete="cc-exp-year"
              value={card.expiryYear || ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, "").slice(0, 4));
                setCard({ ...card, expiryYear: Number.isFinite(n) ? n : 0 });
              }}
            />
          </label>
          <label>
            CVV
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={4}
              autoComplete="cc-csc"
              placeholder="123"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Processing…" : `Pay ${amount} BHD`}
        </button>
      </form>

      <details className="checkout-help">
        <summary>Test cards (no real charge)</summary>
        <p>
          Most numbers approve. Ending <code>0002</code> declines, <code>0119</code> is insufficient
          funds, <code>0069</code> errors.
        </p>
      </details>
    </>,
  );
}
