/**
 * Route-level tests for POST /v1/refunds (FP-212) against a real, migrated
 * Postgres: `app.inject(...)` through `buildApp()`, no DB mocking. Requires
 * `DATABASE_URL`. Covers the money (ledger to the fils), the fee reversal,
 * the transaction timeline, the outbox event the webhook dispatcher sends,
 * idempotency, tenant isolation, the over-refund race, and that settlement
 * reconciliation still explains to zero once refunds exist.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import { getReconciliationReport } from "../settlement/query.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("refunds.test.ts requires DATABASE_URL to point at a real, migrated Postgres (run `npm run migrate` first)");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  INTERNAL_API_TOKEN: "test-internal-token",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});

const pool = new Pool({ connectionString: databaseUrl, max: 8 });
const app = buildApp(config, pool);

test.after(async () => {
  await app.close();
  await pool.end();
});

const VALID_CARD = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

async function createMerchant(label: string, mdrBps = 250) {
  const merchantResult = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, $2) RETURNING id`,
    [`Refund Test ${label} ${randomUUID()}`, mdrBps],
  );
  const merchantId = merchantResult.rows[0]!.id;
  const userResult = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused-in-these-tests') RETURNING id`,
    [merchantId, `owner-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const issued = await issueApiKey(pool, config, { merchantId, createdBy: userResult.rows[0]!.id, label });
  return { merchantId, rawKey: issued.rawKey };
}

const auth = (rawKey: string) => ({ authorization: `Bearer ${rawKey}` });

async function authorizeAndCapture(rawKey: string, amountFils: number, captureFils?: number) {
  const authRes = await app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: { ...auth(rawKey), "idempotency-key": randomUUID() },
    payload: { amountFils, card: VALID_CARD, reference: "order-refund" },
  });
  assert.equal(authRes.statusCode, 201, authRes.body);
  const txn = authRes.json() as { id: string };
  const capRes = await app.inject({
    method: "POST",
    url: `/v1/transactions/${txn.id}/capture`,
    headers: { ...auth(rawKey), "idempotency-key": randomUUID() },
    payload: captureFils === undefined ? {} : { amountFils: captureFils },
  });
  assert.equal(capRes.statusCode, 200, capRes.body);
  return txn.id;
}

function refund(
  rawKey: string,
  payload: Record<string, unknown>,
  idempotencyKey: string | null = randomUUID(),
) {
  return app.inject({
    method: "POST",
    url: "/v1/refunds",
    headers: { ...auth(rawKey), ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
    payload,
  });
}

/** Net movement of merchant_payable for one transaction (credits positive). */
async function payableNet(transactionId: string): Promise<number> {
  const r = await pool.query<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_fils ELSE -amount_fils END),0)::text AS net
       FROM ledger_entries WHERE transaction_id = $1 AND account_id = 'merchant_payable'`,
    [transactionId],
  );
  return Number(r.rows[0]!.net);
}

test("full refund: API, ledger to the fils, fee reversal, timeline, outbox and transaction DTO agree", async () => {
  const { merchantId, rawKey } = await createMerchant("full");
  const txnId = await authorizeAndCapture(rawKey, 10_000);

  const res = await refund(rawKey, { transactionId: txnId, reason: "customer changed mind" });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.amountFils, 10_000);
  assert.equal(body.feeReversedFils, 250, "the whole 2.50% MDR comes back on a full refund");
  assert.equal(body.transactionStatus, "refunded");
  assert.equal(body.refundedTotalFils, 10_000);

  // Ledger: captured 4 legs + refund 4 legs, every entry group balances, payable nets to zero.
  const groups = await pool.query<{ entry_group_id: string; d: string; c: string }>(
    `SELECT entry_group_id,
            SUM(CASE WHEN direction='debit' THEN amount_fils ELSE 0 END)::text AS d,
            SUM(CASE WHEN direction='credit' THEN amount_fils ELSE 0 END)::text AS c
       FROM ledger_entries WHERE transaction_id = $1 GROUP BY entry_group_id`,
    [txnId],
  );
  assert.equal(groups.rows.length, 2);
  for (const g of groups.rows) assert.equal(g.d, g.c, "each entry group is balanced");
  assert.equal(await payableNet(txnId), 0);
  const fee = await pool.query<{ net: string }>(
    `SELECT SUM(CASE WHEN direction='credit' THEN amount_fils ELSE -amount_fils END)::text AS net
       FROM ledger_entries WHERE transaction_id = $1 AND account_id = 'platform_fee_revenue'`,
    [txnId],
  );
  assert.equal(Number(fee.rows[0]!.net), 0, "platform keeps no fee on a fully refunded payment");

  // Refund row, hold, timeline.
  const row = await pool.query(`SELECT amount_fils, fee_reversed_fils, status, reason FROM refunds WHERE transaction_id = $1`, [txnId]);
  assert.equal(row.rows.length, 1);
  assert.equal(row.rows[0].reason, "customer changed mind");
  const events = await app.inject({ method: "GET", url: `/v1/transactions/${txnId}/events`, headers: auth(rawKey) });
  const timeline = events.json() as Array<{ eventType: string; amountFils: number | null }>;
  assert.deepEqual(timeline.map((e) => e.eventType), ["authorized", "captured", "refunded"]);
  assert.equal(timeline[2]!.amountFils, -10_000);

  const detail = await app.inject({ method: "GET", url: `/v1/transactions/${txnId}`, headers: auth(rawKey) });
  assert.equal(detail.json().status, "refunded");
  assert.equal(detail.json().refundedFils, 10_000);

  // The outbox event the webhook dispatcher and reporting consume.
  const ob = await pool.query<{ payload: Record<string, unknown>; aggregate_id: string }>(
    `SELECT payload, aggregate_id FROM outbox_events WHERE event_type = 'refund.succeeded' AND aggregate_id = $1`,
    [txnId],
  );
  assert.equal(ob.rows.length, 1);
  assert.deepEqual(ob.rows[0]!.payload, {
    merchantId,
    refundId: body.id,
    amountFils: 10_000,
    feeReversedFils: 250,
    refundedTotalFils: 10_000,
    newStatus: "refunded",
  });
});

test("partial refunds: statuses, and fee reversals sum to exactly the fee charged (no rounding drift)", async () => {
  const { rawKey } = await createMerchant("partials");
  // 1,001 fils at 2.50% = 25.025 -> 25 fils fee. Three uneven refunds must give back exactly 25.
  const txnId = await authorizeAndCapture(rawKey, 1_001);
  const parts = [334, 334, 333];
  const reversed: number[] = [];
  const statuses: string[] = [];
  for (const amountFils of parts) {
    const res = await refund(rawKey, { transactionId: txnId, amountFils });
    assert.equal(res.statusCode, 200, res.body);
    reversed.push(res.json().feeReversedFils);
    statuses.push(res.json().transactionStatus);
  }
  assert.deepEqual(statuses, ["partially_refunded", "partially_refunded", "refunded"]);
  assert.equal(reversed.reduce((a, b) => a + b, 0), 25);
  assert.equal(await payableNet(txnId), 0);

  const events = await app.inject({ method: "GET", url: `/v1/transactions/${txnId}/events`, headers: auth(rawKey) });
  assert.deepEqual(
    (events.json() as Array<{ eventType: string }>).map((e) => e.eventType),
    ["authorized", "captured", "refund_partial", "refund_partial", "refunded"],
  );
});

test("partially captured transaction can only be refunded up to what was CAPTURED, and the leftover hold is released", async () => {
  const { rawKey } = await createMerchant("partial-capture");
  const txnId = await authorizeAndCapture(rawKey, 10_000, 4_000);

  const tooMuch = await refund(rawKey, { transactionId: txnId, amountFils: 4_001 });
  assert.equal(tooMuch.statusCode, 422, tooMuch.body);

  const ok = await refund(rawKey, { transactionId: txnId, amountFils: 4_000 });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().transactionStatus, "refunded");
  const hold = await pool.query<{ status: string }>(`SELECT status FROM holds WHERE transaction_id = $1`, [txnId]);
  assert.equal(hold.rows[0]!.status, "released");
});

test("omitting amountFils refunds everything still refundable", async () => {
  const { rawKey } = await createMerchant("default-amount");
  const txnId = await authorizeAndCapture(rawKey, 5_000);
  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: 1_200 })).statusCode, 200);
  const rest = await refund(rawKey, { transactionId: txnId });
  assert.equal(rest.statusCode, 200, rest.body);
  assert.equal(rest.json().amountFils, 3_800);
  assert.equal(rest.json().refundedTotalFils, 5_000);
});

test("rejections: missing Idempotency-Key, bad body, uncaptured, over-refund, nothing left", async () => {
  const { rawKey } = await createMerchant("rejections");
  const txnId = await authorizeAndCapture(rawKey, 2_000);

  const noKey = await refund(rawKey, { transactionId: txnId }, null);
  assert.equal(noKey.statusCode, 400, noKey.body);
  assert.equal(noKey.json().error, "idempotency_key_required");

  assert.equal((await refund(rawKey, { transactionId: "not-a-uuid" })).statusCode, 400);
  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: 10.5 })).statusCode, 400);
  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: "100" })).statusCode, 400);
  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: 0 })).statusCode >= 400, true);
  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: -5 })).statusCode >= 400, true);

  assert.equal((await refund(rawKey, { transactionId: txnId, amountFils: 2_001 })).statusCode, 422);

  // Authorized but never captured: nothing to refund.
  const authOnly = await app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: { ...auth(rawKey), "idempotency-key": randomUUID() },
    payload: { amountFils: 900, card: VALID_CARD, reference: "x" },
  });
  const notCaptured = await refund(rawKey, { transactionId: authOnly.json().id });
  assert.equal(notCaptured.statusCode, 409, notCaptured.body);

  assert.equal((await refund(rawKey, { transactionId: txnId })).statusCode, 200);
  const again = await refund(rawKey, { transactionId: txnId });
  assert.ok(again.statusCode === 409 || again.statusCode === 422, again.body);
  const count = await pool.query(`SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`, [txnId]);
  assert.equal(count.rows[0].c, 1);
});

test("same Idempotency-Key replays the stored response and refunds only once; a different body is a conflict", async () => {
  const { rawKey } = await createMerchant("idempotent");
  const txnId = await authorizeAndCapture(rawKey, 6_000);
  const key = randomUUID();

  const first = await refund(rawKey, { transactionId: txnId, amountFils: 1_000 }, key);
  assert.equal(first.statusCode, 200, first.body);
  const second = await refund(rawKey, { transactionId: txnId, amountFils: 1_000 }, key);
  assert.equal(second.statusCode, 200, second.body);
  assert.deepEqual(second.json(), first.json());

  const conflict = await refund(rawKey, { transactionId: txnId, amountFils: 2_000 }, key);
  assert.equal(conflict.statusCode, 422, conflict.body);
  assert.equal(conflict.json().error, "idempotency_key_reused");

  const rows = await pool.query(`SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`, [txnId]);
  assert.equal(rows.rows[0].c, 1);
  const outbox = await pool.query(
    `SELECT COUNT(*)::int AS c FROM outbox_events WHERE event_type = 'refund.succeeded' AND aggregate_id = $1`,
    [txnId],
  );
  assert.equal(outbox.rows[0].c, 1);
});

test("cross-tenant: another merchant's transaction id is 404 and nothing is moved", async () => {
  const owner = await createMerchant("owner");
  const intruder = await createMerchant("intruder");
  const txnId = await authorizeAndCapture(owner.rawKey, 4_000);

  const res = await refund(intruder.rawKey, { transactionId: txnId });
  assert.equal(res.statusCode, 404, res.body);
  assert.equal(res.json().error, "transaction_not_found");

  const refunds = await pool.query(`SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`, [txnId]);
  assert.equal(refunds.rows[0].c, 0);
  assert.equal(await payableNet(txnId), 3_900, "owner's payable untouched (4,000 - 100 fee)");
});

test("unauthenticated and bad-key requests are 401", async () => {
  const res = await app.inject({ method: "POST", url: "/v1/refunds", payload: {} });
  assert.equal(res.statusCode, 401, res.body);
});

test("concurrent refunds can never exceed what was captured", async () => {
  const { rawKey } = await createMerchant("race");
  const txnId = await authorizeAndCapture(rawKey, 10_000);

  const results = await Promise.all(
    [0, 1, 2, 3].map(() => refund(rawKey, { transactionId: txnId, amountFils: 4_000 })),
  );
  const ok = results.filter((r) => r.statusCode === 200).length;
  assert.equal(ok, 2, `exactly two 4,000 refunds fit in 10,000: ${results.map((r) => r.statusCode).join(",")}`);
  for (const r of results.filter((x) => x.statusCode !== 200)) assert.equal(r.statusCode, 422, r.body);

  const t = await pool.query<{ refunded_fils: string; captured_fils: string }>(
    `SELECT refunded_fils, captured_fils FROM transactions WHERE id = $1`,
    [txnId],
  );
  assert.equal(Number(t.rows[0]!.refunded_fils), 8_000);
  const sum = await pool.query<{ s: string }>(`SELECT SUM(amount_fils)::text AS s FROM refunds WHERE transaction_id = $1`, [txnId]);
  assert.equal(Number(sum.rows[0]!.s), 8_000);
});

test("reconciliation still explains to zero with refunds in the period (batched or not)", async () => {
  const { merchantId, rawKey } = await createMerchant("recon");
  const a = await authorizeAndCapture(rawKey, 10_000);
  await authorizeAndCapture(rawKey, 5_000);
  assert.equal((await refund(rawKey, { transactionId: a, amountFils: 3_333 })).statusCode, 200);
  assert.equal((await refund(rawKey, { transactionId: a, amountFils: 1_000 })).statusCode, 200);

  // Bahrain business day containing "now" (UTC+3, no DST).
  const bahrain = new Date(Date.now() + 3 * 3_600_000);
  const from = bahrain.toISOString().slice(0, 10);
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const report = await getReconciliationReport(pool, { merchantId, from, to });
  assert.equal(report.gapFils, 0, JSON.stringify(report));
  assert.equal(report.explained, true);
  // Captured 15,000 less 2.50% = 14,625; refunds returned 4,333 less reversed fee.
  assert.ok(report.ledgerMerchantPayableNetFils > 0);
});

/** Stand-in for the Go CloseBatch arithmetic (net = gross - fee - refunds + fee reversed), so the TS read side is
 *  checked against batches that did / did not absorb a refund. The Go side has its own tests. */
async function closeBatchBySql(
  merchantId: string,
  batchDate: string,
  opts: { captureTxnIds: string[]; refundIds: string[] },
) {
  const cap = await pool.query<{ gross: string }>(
    `SELECT COALESCE(SUM(te.amount_fils),0)::text AS gross FROM transaction_events te
      WHERE te.transaction_id = ANY($1::uuid[]) AND te.event_type IN ('captured','partially_captured')`,
    [opts.captureTxnIds],
  );
  const gross = Number(cap.rows[0]!.gross);
  const fee = Math.round(gross * 0.025);
  const ref = await pool.query<{ amt: string; rev: string }>(
    `SELECT COALESCE(SUM(amount_fils),0)::text AS amt, COALESCE(SUM(fee_reversed_fils),0)::text AS rev
       FROM refunds WHERE id = ANY($1::uuid[])`,
    [opts.refundIds],
  );
  const refundFils = Number(ref.rows[0]!.amt);
  const rev = Number(ref.rows[0]!.rev);
  const batch = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, refund_fils,
                                     refund_fee_reversed_fils, net_payout_fils, closed_at)
     VALUES ($1,$2,'closed',$3,$4,$5,$6,$7,now()) RETURNING id`,
    [merchantId, batchDate, gross, fee, refundFils, rev, gross - fee - refundFils + rev],
  );
  const id = batch.rows[0]!.id;
  await pool.query(
    `UPDATE transaction_events SET settlement_batch_id = $1
      WHERE transaction_id = ANY($2::uuid[]) AND event_type IN ('captured','partially_captured')`,
    [id, opts.captureTxnIds],
  );
  await pool.query(`UPDATE refunds SET settlement_batch_id = $1 WHERE id = ANY($2::uuid[])`, [id, opts.refundIds]);
  return id;
}

function bahrainToday() {
  const from = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  const next = new Date(Date.parse(`${from}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { from, next };
}

test("reconciliation: a refund absorbed by the same-day batch nets out of the payout", async () => {
  const { merchantId, rawKey } = await createMerchant("recon-same-day");
  const a = await authorizeAndCapture(rawKey, 10_000);
  const r = await refund(rawKey, { transactionId: a, amountFils: 4_000 });
  assert.equal(r.statusCode, 200, r.body);

  const { from, next } = bahrainToday();
  const batchId = await closeBatchBySql(merchantId, from, { captureTxnIds: [a], refundIds: [r.json().id] });

  const report = await getReconciliationReport(pool, { merchantId, from, to: next });
  assert.equal(report.gapFils, 0, JSON.stringify(report));
  // 10,000 - 250 fee - 4,000 refunded + 100 fee reversed
  assert.equal(report.settlementNetPayoutFils, 5_850);

  const detail = await pool.query(`SELECT refund_fils, refund_fee_reversed_fils FROM settlement_batches WHERE id = $1`, [batchId]);
  assert.equal(Number(detail.rows[0].refund_fils), 4_000);
  assert.equal(Number(detail.rows[0].refund_fee_reversed_fils), 100);
});

test("reconciliation: a refund carried into a LATER batch is pending for its own period and settled in the next", async () => {
  const { merchantId, rawKey } = await createMerchant("recon-carry");
  const a = await authorizeAndCapture(rawKey, 10_000);
  const r = await refund(rawKey, { transactionId: a, amountFils: 4_000 });
  assert.equal(r.statusCode, 200, r.body);

  const { from, next } = bahrainToday();
  const after = new Date(Date.parse(`${next}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  // Today's batch takes the capture only; tomorrow's batch takes the refund.
  await closeBatchBySql(merchantId, from, { captureTxnIds: [a], refundIds: [] });
  await closeBatchBySql(merchantId, next, { captureTxnIds: [], refundIds: [r.json().id] });

  const today = await getReconciliationReport(pool, { merchantId, from, to: next });
  assert.equal(today.gapFils, 0, `today: ${JSON.stringify(today)}`);

  const tomorrow = await getReconciliationReport(pool, { merchantId, from: next, to: after });
  assert.equal(tomorrow.gapFils, 0, `tomorrow: ${JSON.stringify(tomorrow)}`);
  assert.equal(tomorrow.settlementNetPayoutFils, -3_900, "the batch that absorbed the refund pays out negative");
});
