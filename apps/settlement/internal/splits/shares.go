package splits

import (
	"sort"

	"github.com/filspay/settlement/internal/money"
)

// ChildWeight is one sub-merchant's configured share of a parent's payout.
type ChildWeight struct {
	WeightBps int64
}

// ChildShares distributes netPayout across children by their weights using
// the largest-remainder method, so the shares always sum to netPayout.
// Ties on remainder are broken by ascending index (the same order the
// caller supplied, which PayoutSplitBatch keeps as child_merchant_id).
func ChildShares(netPayout money.Fils, children []ChildWeight) []money.Fils {
	out := make([]money.Fils, len(children))
	if len(children) == 0 {
		return out
	}

	var sumW int64
	for _, c := range children {
		sumW += c.WeightBps
	}
	if sumW == 0 {
		return out
	}

	type ranked struct {
		i   int
		rem int64
	}
	order := make([]ranked, len(children))
	total := int64(netPayout)
	var allocated int64
	for i, c := range children {
		product := total * c.WeightBps
		base := product / sumW
		out[i] = money.Fils(base)
		order[i] = ranked{i: i, rem: product - base*sumW}
		allocated += base
	}

	leftover := total - allocated
	sort.Slice(order, func(i, j int) bool {
		if order[i].rem != order[j].rem {
			return order[i].rem > order[j].rem
		}
		return order[i].i < order[j].i
	})
	for k := 0; k < len(order) && leftover > 0; k++ {
		out[order[k].i]++
		leftover--
	}
	return out
}
