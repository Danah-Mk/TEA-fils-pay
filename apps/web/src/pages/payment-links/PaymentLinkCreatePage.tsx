import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseBhdToFils } from "@filspay/money";
import { createPaymentLink } from "../../api/paymentLinks.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { localDateTimeToIso } from "../../format.js";

/**
 * `POST /v1/merchants/:merchantId/payment-links`, `owner`/`finance`
 * server-side.
 *
 * Amount is entered in fils — the platform's actual unit, and the same unit
 * the checkout page works in. No decimal-BHD input widget: a second
 * string-to-fils parser in the browser is exactly the kind of place a money
 * bug hides, and `parseBhdToFils` exists in @filspay/money for whenever a
 * phase genuinely wants that UI.
 *
 * The two client-side checks below mirror the server's own two real checks so
 * an obviously-bad value doesn't need a round trip. They are not the
 * validation: `400 invalid_amount` / `400 invalid_expiry` remain the real
 * answer and are rendered verbatim.
 */
export function PaymentLinkCreatePage() {
  const { me } = useDashboardAuth();
  const navigate = useNavigate();

  const [amountBhd, setAmountBhd] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // YA: amount typed as raw fils, no BD conversion. intentional for now
  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!me) return;
    setError(null);

    let amount: number;
    try {
      amount = Number(parseBhdToFils(amountBhd));
    } catch {
      setError("Enter a BHD amount with up to 3 decimal places, for example 2.500.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    const expiresAtIso = localDateTimeToIso(expiresAt);
    if (!expiresAtIso) {
      setError("Expiry must be a valid date and time.");
      return;
    }
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      setError("Expiry must be in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const link = await createPaymentLink(me.merchant.id, {
        amountFils: amount,
        reference: reference.trim() || undefined,
        description: description.trim() || undefined,
        expiresAt: expiresAtIso,
      });
      navigate(`/dashboard/payment-links/${link.id}`, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="dash-page-head">
        <div>
          <h1>New payment link</h1>
          <p>The customer pays this amount on a public checkout page. No login.</p>
        </div>
      </div>

      {error ? <p className="dash-error">{error}</p> : null}

      <form className="dash-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Amount in BHD
          <input
            type="text"
            inputMode="decimal"
            required
            placeholder="2.500"
            value={amountBhd}
            onChange={(e) => setAmountBhd(e.target.value)}
          />
        </label>
        <p className="dash-muted dash-hint">Three decimal places. 2.500 BHD is 2,500 fils.</p>
        <label>
          Reference (optional)
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label>
          Description (optional)
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Expires at
          <input
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <button type="submit" className="dash-button dash-button-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create payment link"}
        </button>
      </form>

      <p>
        <Link to="/dashboard/payment-links">Back to payment links</Link>
      </p>
    </section>
  );
}
