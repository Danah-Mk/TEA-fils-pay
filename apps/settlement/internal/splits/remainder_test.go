package splits

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

func TestChildShares_LargestRemainderExactSum(t *testing.T) {
	// Independent ApplyRateFils on these weights rounds to 334+334+334=1002.
	children := []ChildWeight{{3333}, {3333}, {3334}}
	shares := ChildShares(1001, children)
	if shares[0] != 334 || shares[1] != 333 || shares[2] != 334 {
		t.Errorf("shares = %v, want [334 333 334]", shares)
	}
	var total money.Fils
	for _, s := range shares {
		total += s
	}
	if total != 1001 {
		t.Errorf("sum of shares %v = %d, want 1001", shares, total)
	}
}

func TestChildShares_RemainderTieBreaksByIndex(t *testing.T) {
	// Equal weights, leftover fils go to the earliest indexes.
	shares := ChildShares(10, []ChildWeight{{1}, {1}, {1}})
	if shares[0]+shares[1]+shares[2] != 10 {
		t.Fatalf("shares %v do not sum to 10", shares)
	}
	if shares[0] != 4 || shares[1] != 3 || shares[2] != 3 {
		t.Errorf("shares = %v, want [4 3 3] (leftover to lowest index)", shares)
	}
}
