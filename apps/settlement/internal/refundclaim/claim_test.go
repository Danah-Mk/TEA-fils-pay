package refundclaim

import (
	"reflect"
	"testing"

	"github.com/filspay/settlement/internal/money"
)

func TestClaimTakesEverythingTheBatchCanAbsorb(t *testing.T) {
	refunds := []Refund{
		{AmountFils: 4_000, FeeReversedFils: 100},
		{AmountFils: 1_000, FeeReversedFils: 25},
	}
	got := Claim(9_750, refunds)
	if !reflect.DeepEqual(got.Claimed, []int{0, 1}) || len(got.Deferred) != 0 {
		t.Fatalf("claimed %v deferred %v", got.Claimed, got.Deferred)
	}
	if got.RefundFils != 5_000 || got.FeeReversedFils != 125 {
		t.Fatalf("refund %d feeReversed %d", got.RefundFils, got.FeeReversedFils)
	}
	if net := NetPayout(10_000, 250, got.RefundFils, got.FeeReversedFils); net != 4_875 {
		t.Fatalf("net %d, want 4875", net)
	}
}

func TestClaimDefersARefundThatWouldMakeThePayoutNegative(t *testing.T) {
	// 1_000 captured net, refund net 3_900 cannot be absorbed; it carries on.
	got := Claim(1_000, []Refund{{AmountFils: 4_000, FeeReversedFils: 100}})
	if len(got.Claimed) != 0 || !reflect.DeepEqual(got.Deferred, []int{0}) {
		t.Fatalf("claimed %v deferred %v", got.Claimed, got.Deferred)
	}
	if got.RefundFils != 0 || got.FeeReversedFils != 0 {
		t.Fatalf("a deferred refund must not touch the totals: %+v", got)
	}
}

func TestClaimSkipsABlockingRefundButStillTakesLaterSmallerOnes(t *testing.T) {
	got := Claim(2_000, []Refund{
		{AmountFils: 5_000, FeeReversedFils: 0},
		{AmountFils: 800, FeeReversedFils: 20},
	})
	if !reflect.DeepEqual(got.Claimed, []int{1}) || !reflect.DeepEqual(got.Deferred, []int{0}) {
		t.Fatalf("claimed %v deferred %v", got.Claimed, got.Deferred)
	}
}

func TestClaimCanDriveThePayoutToExactlyZero(t *testing.T) {
	got := Claim(975, []Refund{{AmountFils: 1_000, FeeReversedFils: 25}})
	if len(got.Claimed) != 1 {
		t.Fatalf("a refund whose net equals the captured net is absorbed, got %+v", got)
	}
	if net := NetPayout(1_000, 25, got.RefundFils, got.FeeReversedFils); net != 0 {
		t.Fatalf("net %d, want 0", net)
	}
}

func TestClaimWithNoRefundsIsANoOp(t *testing.T) {
	got := Claim(500, nil)
	if got.Claimed != nil || got.Deferred != nil || got.RefundFils != 0 {
		t.Fatalf("unexpected %+v", got)
	}
}

func TestNetPayoutKeepsFilsExact(t *testing.T) {
	// 3 digits of fils must survive; no float round trip.
	var gross, fee money.Fils = 9_999_999_999, 24_999_999
	if got := NetPayout(gross, fee, 1, 0); got != 9_974_999_999 {
		t.Fatalf("got %d", got)
	}
}
