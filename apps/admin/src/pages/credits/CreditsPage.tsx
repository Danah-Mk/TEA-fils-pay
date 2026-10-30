import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatBhd, parseBhdToFils, toFils } from "@filspay/money";
import {
  approveCreditRequest,
  issueCredit,
  listCreditRequests,
  rejectCreditRequest,
} from "../../api/credits.js";
import { listMerchants } from "../../api/merchants.js";
import { describeError } from "../../api/client.js";
import { RequireRole } from "../../auth/RequireRole.js";
import type {
  AdminMerchantSummary,
  CreditReasonCode,
  CreditRequestDto,
  CreditRequestStatus,
} from "../../types.js";

function bhd(fils: number): string {
  return `${formatBhd(toFils(fils, { allowNegative: true }))} BHD`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

const STATUS_TABS: Array<{ value: CreditRequestStatus; label: string }> = [
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "posted", label: "Posted" },
  { value: "rejected", label: "Rejected" },
];

/**
 * The checker half of maker-checker: every credit waiting on a second
 * operator, plus the history of what was posted or declined.
 *
 * Approve and Reject are wrapped in `RequireRole` so a support operator
 * isn't shown a control that would answer 403 — the gate itself lives on the
 * route, server-side.
 */
export function CreditsPage() {
  const [status, setStatus] = useState<CreditRequestStatus>("pending_approval");
  const [items, setItems] = useState<CreditRequestDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingReject, setPendingReject] = useState<string | null>(null);

  const [merchants, setMerchants] = useState<AdminMerchantSummary[]>([]);
  const [issueMerchantId, setIssueMerchantId] = useState("");
  const [creditAmountBhd, setCreditAmountBhd] = useState("");
  const [creditReason, setCreditReason] = useState<CreditReasonCode>("goodwill");
  const [creditMemo, setCreditMemo] = useState("");
  const [creditReverseFee, setCreditReverseFee] = useState(false);
  const [creditEffectiveDate, setCreditEffectiveDate] = useState(todayIso());
  const [issueBusy, setIssueBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const page = await listCreditRequests({ status });
      setItems(page.items ?? []);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listMerchants({ onboardingStatus: ["approved"], limit: 50 })
      .then((page) => {
        const rows = page.merchants ?? [];
        setMerchants(rows);
        setIssueMerchantId((current) => current || rows[0]?.id || "");
      })
      .catch(() => {
        /* list still works without the dropdown if merchants fail to load */
      });
  }, []);

  async function loadMore(): Promise<void> {
    if (!nextCursor) return;
    try {
      const page = await listCreditRequests({ status, cursor: nextCursor });
      setItems((current) => [...current, ...(page.items ?? [])]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setLoadError(describeError(err));
    }
  }

  async function handleIssueCredit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!issueMerchantId) {
      setActionError("Pick a merchant.");
      return;
    }
    setIssueBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const baseAmountFils = parseBhdToFils(creditAmountBhd);
      const record = await issueCredit(issueMerchantId, {
        baseAmountFils,
        reasonCode: creditReason,
        effectiveDate: creditEffectiveDate,
        reverseFee: creditReverseFee,
        memo: creditMemo.trim() ? creditMemo.trim() : undefined,
      });
      setNotice(
        record.status === "posted"
          ? `Credit of ${bhd(record.postedAmountFils)} posted to the ledger.`
          : `Credit of ${bhd(record.postedAmountFils)} raised. Approve it below as a different finance admin (not the one who created it).`,
      );
      setCreditAmountBhd("");
      setCreditMemo("");
      setCreditReverseFee(false);
      if (status === "pending_approval") {
        await load();
      } else {
        setStatus("pending_approval");
      }
    } catch (err) {
      setActionError(err instanceof RangeError ? err.message : describeError(err));
    } finally {
      setIssueBusy(false);
    }
  }

  async function handleApprove(id: string): Promise<void> {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      const record = await approveCreditRequest(id);
      setNotice(
        `Approved. ${bhd(record.postedAmountFils)} journaled to entry group ${
          record.ledgerEntryGroupId ?? "(unknown)"
        }.`,
      );
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string): Promise<void> {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await rejectCreditRequest(id, rejectReason.trim() ? rejectReason.trim() : undefined);
      setNotice("Credit request rejected. Nothing was journaled.");
      setPendingReject(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1>Merchant credits</h1>
      <p className="admin-muted">
        Manual credits are journaled to <code>ledger_entries</code> like any other money movement.
        A credit above the approval limit cannot post until a second <code>finance</code> or{" "}
        <code>super_admin</code> operator — not the one who raised it — approves it.
      </p>

      <h2>Create credit</h2>
      <RequireRole
        allow={["finance", "super_admin"]}
        fallback={
          <p className="admin-muted">Your role cannot issue credits. Ask a finance admin.</p>
        }
      >
        <form className="admin-form" onSubmit={(e) => void handleIssueCredit(e)}>
          <label>
            Merchant
            <select
              required
              value={issueMerchantId}
              onChange={(e) => setIssueMerchantId(e.target.value)}
            >
              {merchants.length === 0 ? <option value="">Loading merchants…</option> : null}
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                  {m.testMode ? " (test)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (BD, up to 3 decimals)
            <input
              type="text"
              required
              placeholder="50.000"
              value={creditAmountBhd}
              onChange={(e) => setCreditAmountBhd(e.target.value)}
            />
          </label>
          <label>
            Reason
            <select
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value as CreditReasonCode)}
            >
              <option value="goodwill">Goodwill</option>
              <option value="dispute_resolution">Dispute resolution</option>
              <option value="correction">Correction</option>
            </select>
          </label>
          <label>
            Effective date
            <input
              type="date"
              required
              value={creditEffectiveDate}
              onChange={(e) => setCreditEffectiveDate(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={creditReverseFee}
              onChange={(e) => setCreditReverseFee(e.target.checked)}
            />{" "}
            Also reverse the MDR on this amount
          </label>
          <label>
            Memo (optional)
            <textarea value={creditMemo} onChange={(e) => setCreditMemo(e.target.value)} rows={2} />
          </label>
          <button type="submit" disabled={issueBusy || !issueMerchantId}>
            {issueBusy ? "Submitting..." : "Create credit"}
          </button>
        </form>
      </RequireRole>

      <nav className="admin-nav">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            disabled={tab.value === status}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loadError ? <p className="admin-error">{loadError}</p> : null}
      {actionError ? <p className="admin-error">{actionError}</p> : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      {items.length === 0 ? (
        <p className="admin-muted">Nothing here.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Requested by</th>
              <th>Merchant</th>
              <th>Reason</th>
              <th>Base</th>
              <th>Fee reversal</th>
              <th>Posted total</th>
              <th>Effective date</th>
              <th>Approved by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.requestedByDisplayName}</td>
                <td>
                  <Link to={`/merchants/${item.merchantId}`}>
                    <code>{item.merchantId.slice(0, 8)}</code>
                  </Link>
                </td>
                <td>
                  {item.reasonCode}
                  {item.memo ? <div className="admin-muted">{item.memo}</div> : null}
                </td>
                <td>{bhd(item.baseAmountFils)}</td>
                <td>{item.feeReversalFils > 0 ? bhd(item.feeReversalFils) : "-"}</td>
                <td>
                  <strong>{bhd(item.postedAmountFils)}</strong>
                </td>
                <td>{item.effectiveDate}</td>
                <td>{item.approvedByDisplayName ?? "-"}</td>
                <td>
                  {item.status === "pending_approval" ? (
                    <RequireRole
                      allow={["finance", "super_admin"]}
                      fallback={<span className="admin-muted">finance role required</span>}
                    >
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleApprove(item.id)}
                      >
                        Approve
                      </button>{" "}
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => setPendingReject(item.id)}
                      >
                        Reject
                      </button>
                    </RequireRole>
                  ) : (
                    item.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingReject ? (
        <div className="admin-confirm">
          <p>
            <strong>Reject this credit request?</strong> Nothing is journaled, and the request
            cannot be approved afterwards.
          </p>
          <label>
            Reason (optional — recorded in the admin audit log)
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busyId === pendingReject}
            onClick={() => void handleReject(pendingReject)}
          >
            Yes, reject it
          </button>{" "}
          <button
            type="button"
            onClick={() => {
              setPendingReject(null);
              setRejectReason("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {nextCursor ? (
        <p>
          <button type="button" onClick={() => void loadMore()}>
            Load more
          </button>
        </p>
      ) : null}
    </section>
  );
}
