# Dockerfiles were missing; compose had no API memory limit or token

**What is wrong / why:** Compose referenced `ops/Dockerfile.node` and `Dockerfile.go` which were absent. Settlement token was documented as defaulting to `dev-token` but the binary exits without it. API 512 MB was documentation only. Seed was described as safe on a shared DB.

**The fix:** Add both Dockerfiles. Set `SETTLEMENT_INTERNAL_TOKEN`, webhook key, signature required. `mem_limit: 512m` / `cpus: 0.5` on the API. Seed comment warns it is destructive.

**Files:** `ops/Dockerfile.node`, `ops/Dockerfile.go`, `ops/docker-compose.yml`, `ops/README.md`
