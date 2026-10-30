# KYC "PDF only" trusted the filename

**What is wrong / why:** Magic bytes ran first, then PDF-only types checked `.pdf` on the name. A JPEG named `cr.pdf` passed. Sharp had no `limitInputPixels`.

**The fix:** Require `detected === "pdf"`. `sharp(buffer, { limitInputPixels: 24_000_000 })`.

**Files:** `apps/api/src/onboarding/kyc.ts`, `apps/api/src/onboarding/kycThumbnail.ts`
