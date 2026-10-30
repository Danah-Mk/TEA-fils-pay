package settlement

import (
	"context"
	"testing"
	"time"
)

func TestRecalculateMDR_SkipsPaidBatches(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const originalMdrBps = 250
	merchantID := insertActiveMerchant(t, pool, originalMdrBps)

	businessDate := time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	insertCaptureEvent(t, pool, merchantID, originalMdrBps, 20_000, start.Add(time.Hour))

	closed, err := CloseBatch(ctx, pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	if _, err := PayoutBatch(ctx, pool, closed.BatchID); err != nil {
		t.Fatalf("PayoutBatch: %v", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 400 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("update mdr_bps: %v", err)
	}

	from, to := recalcWindow(businessDate)
	result, err := RecalculateMDR(ctx, pool, merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}
	if result.BatchesConsidered != 0 {
		t.Errorf("BatchesConsidered = %d, want 0 (paid batches must be left alone)", result.BatchesConsidered)
	}
	if len(result.Adjusted) != 0 {
		t.Errorf("len(Adjusted) = %d, want 0", len(result.Adjusted))
	}

	var gotFee int64
	if err := pool.QueryRow(ctx, `SELECT fee_fils FROM settlement_batches WHERE id = $1`, closed.BatchID).Scan(&gotFee); err != nil {
		t.Fatalf("read paid batch: %v", err)
	}
	if gotFee != int64(closed.FeeFils) {
		t.Errorf("paid batch fee_fils = %d, want %d (unchanged)", gotFee, closed.FeeFils)
	}
}

func TestRecalculateMDR_UsesFeeScheduleNotCurrentMdr(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const originalMdrBps int64 = 250
	merchantID := insertActiveMerchant(t, pool, originalMdrBps)

	businessDate := time.Date(2026, 5, 3, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	insertCaptureEvent(t, pool, merchantID, originalMdrBps, 10_000, start.Add(time.Hour))

	closed, err := CloseBatch(ctx, pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}

	// Backdated schedule at 180 bps; merchants.mdr_bps stays 250. Recalc must
	// follow the schedule the way CloseBatch would, not the merchant column.
	insertFeeSchedule(t, pool, merchantID, 180, start.Add(-time.Hour))

	from, to := recalcWindow(businessDate)
	result, err := RecalculateMDR(ctx, pool, merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}
	if result.BatchesConsidered != 1 {
		t.Fatalf("BatchesConsidered = %d, want 1", result.BatchesConsidered)
	}
	if len(result.Adjusted) != 1 {
		t.Fatalf("len(Adjusted) = %d, want 1 (schedule 180 vs closed-at 250)", len(result.Adjusted))
	}

	wantFee := ComputeSettlementFee(10_000, 180, 0)
	if result.Adjusted[0].NewFeeFils != wantFee {
		t.Errorf("NewFeeFils = %d, want %d (schedule rate)", result.Adjusted[0].NewFeeFils, wantFee)
	}
	if result.Adjusted[0].OldFeeFils != closed.FeeFils {
		t.Errorf("OldFeeFils = %d, want %d", result.Adjusted[0].OldFeeFils, closed.FeeFils)
	}
}
