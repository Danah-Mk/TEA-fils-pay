# Scheme file rounded up; truncation residue never booked

**What is wrong / why:** scheme_export_lines.amount was stored from the UNtruncated gross, so numeric(10,2) rounded half up (+0.01 BD on 123 of 260 lines) while amount_fils was truncated; the difference was never posted.

**What it breaks:** File and scheme disagree; card_scheme_clearing stays overstated (1,153 fils in one file). Apply AFTER patch 05 (same file).

**The fix:** Store the truncated amount; post the residue as a balanced pair to scheme_rounding_residue / card_scheme_clearing.

**How to check:** SQL tested in Postgres (balanced pair accepted, unbalanced rejected).

**Files:** apps/settlement/internal/settlement/batch.go
