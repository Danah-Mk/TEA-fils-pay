# ops/

Local development stack for FilsPay: Postgres plus the three services that
talk to it directly (apps/api, apps/settlement, apps/reporting). The hosted
demo instance uses the same compose file with a different `.env`.

## Quick start

```
docker compose -f ops/docker-compose.yml up -d postgres
docker compose -f ops/docker-compose.yml run --rm migrate
docker compose -f ops/docker-compose.yml run --rm seed
docker compose -f ops/docker-compose.yml up api settlement reporting
```

apps/web and apps/admin aren't part of this compose file — they're plain
Vite dev servers that talk to apps/api over HTTP (`npm run dev` inside
each package), not services with their own database connection.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | the stack |
| `.env.docker` | shared service settings, loaded by compose for every service |
| `Dockerfile.node` | image for api, reporting, migrate and seed (`node:22-slim`) |
| `Dockerfile.go` | multi-stage build of `apps/settlement` |

## Database

Every service, plus the one-off `migrate`/`seed` jobs, connects with the
same `filspay` role and the same `DATABASE_URL`
(`postgres://filspay:filspay_dev_password@postgres:5432/filspay?sslmode=disable`).
One role keeps local setup to a single password instead of hand-rolling
per-service grants for a stack this size. `sslmode=disable` is safe here:
Postgres and every service run on the same Docker Compose bridge network,
which never carries traffic outside the host, so there's no untrusted hop
for a connection to cross.

`PGCONN_SETTLEMENT`, if set, used to silently override `DATABASE_URL` in
the Go worker. Do not set it in compose; `DATABASE_URL` is the connection
string.

Do **not** run `seed` against a shared or production database. The job
truncates merchants, users and ledger tables. It refuses when
`NODE_ENV=production` unless `SEED_ALLOW_DESTRUCTIVE_RESET=yes`.

## Required settings per service

| Service | Needs | Where it comes from in compose |
|---|---|---|
| api | `DATABASE_URL`, `SETTLEMENT_INTERNAL_URL`, `SETTLEMENT_INTERNAL_TOKEN` | `environment:` |
| api | `WEBHOOK_SECRET_ENCRYPTION_KEY` (required, 32-byte base64) | `environment:` |
| api | `ACQUIRER_CALLBACK_SIGNING_SECRET`, `NODE_ENV` | `.env.docker` |
| settlement | `DATABASE_URL` | `environment:` |
| settlement | `SETTLEMENT_INTERNAL_TOKEN` (required; daemon exits without it) | `environment:` |
| reporting | `DATABASE_URL` | `environment:`; runs `worker` by default |

## Resource sizing

The hosted box is 1 vCPU / 2 GB RAM. Compose limits the API container to
0.5 vCPU / 512 MB, settlement and reporting to 0.25 vCPU / 256 MB each.

> **AM:** first build on the box filled the disk (go build cache). cleared it and it went through on the second try
