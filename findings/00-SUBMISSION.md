# What you still have to do to submit

Each other file in this folder is one defect: what is wrong, why, what it breaks, the fix, how to check. Do not merge them into one write-up for the judges.

## A. Run it on this machine (this environment has no Node/Go/Docker)

1. `npm ci`
2. `docker compose -f ops/docker-compose.yml up -d postgres`
3. `npm run migrate` (through 0076)
4. Do **not** run seed against Dilmune Cloud / any shared DB
5. `npm test`
6. `npm run typecheck`
7. `cd apps/settlement && go test ./...`
8. `npm run build --workspace apps/web` and `--workspace apps/admin`
9. One real batch with a refund: authorize, capture, `POST /v1/refunds` with `Idempotency-Key`, then `settlement run-batch --date=<Bahrain yesterday>`. Reconciliation gap must be 0.

## B. Host on Dilmune Cloud (1 vCPU / 2 GB; API 0.5 vCPU / 512 MB)

Environment:

- `DATABASE_URL`
- `NODE_ENV=production`
- `WEBHOOK_SECRET_ENCRYPTION_KEY` (base64 of 32 bytes)
- `SETTLEMENT_INTERNAL_TOKEN` (required; daemon exits without it)
- `SETTLEMENT_INTERNAL_URL` (api → settlement:8091)
- `ACQUIRER_CALLBACK_SIGNING_SECRET`
- `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE=true`

Start: api, reporting worker, `settlement daemon`. Smoke: `/healthz`, login+OTP, pay a link, refund, webhook `refund.succeeded`.

## C. Hand in

- This `findings/` folder (one file per bug) — the EXPLAIN step
- Three annotated AI transcript excerpts (see `findings/00-AI-TRANSCRIPTS.md`)
- Before/after for checkout, merchant dashboard refund drawer, admin console
- Slide deck for technical defence

## D. Scoring map

| Area | What we did |
|---|---|
| Correctness (100) | Refunds end-to-end + the audit top-12 + tickets/finance items, each explained |
| Capacity (20) | Stream CSV; API 512 MB / 0.5 CPU; healthcheck |
| Hosting (10) | Dockerfiles + compose limits + env list |
| AI usage (10) | Corrected `.cursorrules` / `AGENTS.md` / `CLAUDE.md` + transcripts |
| UI/UX (10) | Refund drawer restored; negative BHD; confirm on money actions |
| Technical defence (20) | This folder is the talking notes |
