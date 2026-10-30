package ledger

import (
	"context"
	"testing"
)

func TestRebuildMerchantBalance_UpsertsCache(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool)

	postLedgerLeg(t, pool, merchantID, "credit", 15000)
	postLedgerLeg(t, pool, merchantID, "debit", 400)
	want := int64(15000 - 400)

	_, err := pool.Exec(ctx, `
		INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at)
		VALUES ($1, 1, now())
	`, merchantID)
	if err != nil {
		t.Fatalf("seed drifted cache: %v", err)
	}

	got, err := RebuildMerchantBalance(ctx, pool, merchantID)
	if err != nil {
		t.Fatalf("RebuildMerchantBalance: %v", err)
	}
	if int64(got) != want {
		t.Errorf("RebuildMerchantBalance = %d, want %d", got, want)
	}

	var cached int64
	err = pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&cached)
	if err != nil {
		t.Fatalf("read cache: %v", err)
	}
	if cached != want {
		t.Errorf("cached_payable_fils = %d, want %d (scoped rebuild must upsert)", cached, want)
	}
}
