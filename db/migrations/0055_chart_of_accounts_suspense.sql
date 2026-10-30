-- Additional suspense accounts for future reconciliation lanes.
-- (chart_of_accounts is (id, name, kind) - see 0007; the old column list did not exist, so the migration failed.)

INSERT INTO chart_of_accounts (id, name, kind)
VALUES
  ('fx_rounding_difference', 'FX Rounding Difference', 'asset'),
  ('chargeback_suspense', 'Chargeback Suspense', 'asset')
ON CONFLICT (id) DO NOTHING;
