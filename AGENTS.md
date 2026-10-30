# AI agent conventions — FilsPay

Updated 2026-10-30 after the security/code audit. The previous version of this
file contained planted claims that contradicted ADR-0001 and ARCHITECTURE.

## Money

1 BD = 1000 fils. Integer fils everywhere (ADR-0001). Use `parseBhdToFils`.
The Go settlement service is the fee reference implementation.

## Settlement

Business day = Asia/Bahrain midnight. Residue is journaled at export (ADR-0002).
Admin rebuild of balances must walk the ledger, same as the CLI.

## Refunds

`POST /v1/refunds` is the live partner route. Do not return 501.

## Security

- Merchant login is password then OTP. Pending sessions grant nothing.
- OTPs and tokens come from `crypto.randomInt` / `crypto.randomBytes`.
- Impersonation is support + read-only.
- Acquirer callbacks require a signature by default.

## Tests

If a test asserts a known defect, change the test when you fix the defect.

## Build

```
npm test
npm run typecheck
cd apps/settlement && go test ./...
```
