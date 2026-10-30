-- FP-adjustment-import: the same CSV could be applied twice (nothing stopped it; original_filename is not unique).
-- applyAdjustmentImport now fingerprints the rows; this column + unique index make a repeat impossible even
-- under a race. Old rows keep NULL (a unique index allows any number of NULLs).
ALTER TABLE adjustment_imports ADD COLUMN content_sha256 TEXT;
CREATE UNIQUE INDEX uq_adjustment_imports_content ON adjustment_imports (content_sha256);
