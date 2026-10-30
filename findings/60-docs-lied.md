# HANDOVER, ONBOARDING and ops README stated false facts

**What is wrong / why:** HANDOVER said processRefund was done and 0054–56 never ran. ONBOARDING said the refund route was a 501 stub. ops README said Dockerfiles were in the repo, seed was safe on a shared DB, and the settlement token defaulted to `dev-token`.

**The fix:** Update those docs to the behaviour after this audit.

**Files:** `docs/HANDOVER.md`, `docs/ONBOARDING.md`, `ops/README.md`
