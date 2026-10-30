package splits

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/money"
)

func mustPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skipping DB-backed test (run against a real, migrated Postgres)")
	}
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("failed to connect to DATABASE_URL: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func insertMerchant(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO merchants (display_name, mdr_bps, status, test_mode)
		VALUES ($1, 250, 'active', false)
		RETURNING id
	`, "split-test-"+uuid.New().String()).Scan(&id)
	if err != nil {
		t.Fatalf("insertMerchant: %v", err)
	}
	return id
}

func insertClosedBatch(t *testing.T, pool *pgxpool.Pool, merchantID uuid.UUID, netPayout int64) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
		VALUES ($1, CURRENT_DATE, 'closed', $2, 0, $2, now())
		RETURNING id
	`, merchantID, netPayout).Scan(&id)
	if err != nil {
		t.Fatalf("insertClosedBatch: %v", err)
	}
	return id
}

func TestPayoutSplitBatch_RejectsWeightsNot10000(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	parent := insertMerchant(t, pool)
	child := insertMerchant(t, pool)
	_, err := pool.Exec(ctx, `
		INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps)
		VALUES ($1, $2, 5000)
	`, parent, child)
	if err != nil {
		t.Fatalf("insert split child: %v", err)
	}
	batchID := insertClosedBatch(t, pool, parent, 10_000)

	_, err = PayoutSplitBatch(ctx, pool, batchID)
	if err == nil {
		t.Fatal("PayoutSplitBatch succeeded with weights summing to 5000, want error")
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM settlement_batches WHERE id = $1`, batchID).Scan(&status); err != nil {
		t.Fatalf("read batch status: %v", err)
	}
	if status != "closed" {
		t.Errorf("status = %q, want closed (must not mark paid on a weight error)", status)
	}
}

func TestPayoutSplitBatch_CreditsChildAndPaysOut(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	parent := insertMerchant(t, pool)
	childA := insertMerchant(t, pool)
	childB := insertMerchant(t, pool)
	_, err := pool.Exec(ctx, `
		INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps)
		VALUES ($1, $2, 5000), ($1, $3, 5000)
	`, parent, childA, childB)
	if err != nil {
		t.Fatalf("insert split children: %v", err)
	}

	const netPayout int64 = 1001
	batchID := insertClosedBatch(t, pool, parent, netPayout)
	_, err = pool.Exec(ctx, `
		INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at)
		VALUES ($1, $2, now())
	`, parent, netPayout)
	if err != nil {
		t.Fatalf("seed parent cache: %v", err)
	}

	result, err := PayoutSplitBatch(ctx, pool, batchID)
	if err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}
	var shareSum money.Fils
	for _, s := range result.Shares {
		shareSum += s.AllocatedFils
	}
	if shareSum != money.Fils(netPayout) {
		t.Errorf("allocated shares sum %d, want %d", shareSum, netPayout)
	}

	var parentPayable int64
	err = pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)
		  FROM ledger_entries
		 WHERE merchant_id = $1 AND account_id = 'merchant_payable' AND settlement_batch_id = $2
	`, parent, batchID).Scan(&parentPayable)
	if err != nil {
		t.Fatalf("parent payable: %v", err)
	}
	if parentPayable != -netPayout {
		t.Errorf("parent merchant_payable net = %d, want %d", parentPayable, -netPayout)
	}

	for _, child := range []uuid.UUID{childA, childB} {
		var childPayable, childCash int64
		err = pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)
			  FROM ledger_entries
			 WHERE merchant_id = $1 AND account_id = 'merchant_payable' AND settlement_batch_id = $2
		`, child, batchID).Scan(&childPayable)
		if err != nil {
			t.Fatalf("child payable: %v", err)
		}
		if childPayable != 0 {
			t.Errorf("child %s merchant_payable net = %d, want 0 (credited then paid out)", child, childPayable)
		}
		err = pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)
			  FROM ledger_entries
			 WHERE merchant_id = $1 AND account_id = 'platform_cash' AND settlement_batch_id = $2
		`, child, batchID).Scan(&childCash)
		if err != nil {
			t.Fatalf("child cash: %v", err)
		}
		if childCash <= 0 {
			t.Errorf("child %s platform_cash net = %d, want a credit (payout)", child, childCash)
		}
	}

	var cached int64
	err = pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, parent).Scan(&cached)
	if err != nil {
		t.Fatalf("parent cache: %v", err)
	}
	if cached != 0 {
		t.Errorf("parent cached_payable_fils = %d, want 0 (ApplyPayout used netPayout)", cached)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM settlement_batches WHERE id = $1`, batchID).Scan(&status); err != nil {
		t.Fatalf("read batch status: %v", err)
	}
	if status != "paid" {
		t.Errorf("status = %q, want paid", status)
	}
}
