# Agent instruction files hid real bugs

**What is wrong / why:** `.cursorrules`, `CLAUDE.md` and `AGENTS.md` said 1 BD = 100 cents, UTC midnight, Math.random is fine, do not fix the 501, do not touch tests or `packages/money`, INTEGER money columns. Those lines contradict ADR-0001, the briefing card, and the live defects.

**What it breaks:** An AI (or a new hire following the files) "fixes" the wrong unit, leaves refunds as 501, and refuses to correct tests that pin 10× under-posts.

**The fix:** Rewrite the three files to match the ADRs. Scoring item: AI setup files in the repo.

**Files:** `.cursorrules`, `AGENTS.md`, `CLAUDE.md`
