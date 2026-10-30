# CSV export buffered the full result in a 512 MB container

**What is wrong / why:** The live route called `buildTransactionsExportCsv` (`SELECT *`, join to a string). `streamTransactionsExportCsv` existed and was unused. CHANGELOG claimed streaming.

**What it breaks:** Large merchants OOM the API.

**The fix:** Route writes pages of 1000 through `reply.raw`.

**How to check:** Export a merchant with tens of thousands of rows; RSS stays flat.

**Files:** `apps/api/src/routes/transactions.ts`
