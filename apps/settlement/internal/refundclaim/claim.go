// Package refundclaim decides which unbatched refunds a settlement batch
// absorbs. It is pure (no database, no pgx) so the rule can be unit tested
// without a Postgres; CloseBatch does the row locking and the UPDATEs.
package refundclaim

import "github.com/filspay/settlement/internal/money"

// Refund is one succeeded, not-yet-batched refunds row.
type Refund struct {
	AmountFils      money.Fils // gross returned to the cardholder
	FeeReversedFils money.Fils // share of the MDR given back to the merchant
}

// Net is what the refund takes out of the merchant's payout: the gross it
// returns minus the fee that is given back.
func (r Refund) Net() money.Fils { return r.AmountFils - r.FeeReversedFils }

// Result is the outcome of one claim pass. Claimed and Deferred hold indexes
// into the slice that was passed to Claim.
type Result struct {
	Claimed         []int
	Deferred        []int // left unbatched, carried to a later batch
	RefundFils      money.Fils
	FeeReversedFils money.Fils
}

// Claim walks refunds oldest-first (the caller passes them in that order)
// and claims each one the batch can still absorb, i.e. while
// capturedNetFils minus everything claimed so far stays >= 0. A refund that
// would push the batch's payout negative is deferred, not dropped: it keeps
// settlement_batch_id NULL and is picked up by the next batch with enough
// captured volume, so a merchant is never paid a negative amount and no
// refund is ever lost. Deferred refunds are skipped, not blocking: a later,
// smaller refund can still be claimed by this batch.
func Claim(capturedNetFils money.Fils, refunds []Refund) Result {
	var res Result
	remaining := capturedNetFils
	for i, r := range refunds {
		if r.Net() <= remaining {
			remaining -= r.Net()
			res.Claimed = append(res.Claimed, i)
			res.RefundFils += r.AmountFils
			res.FeeReversedFils += r.FeeReversedFils
			continue
		}
		res.Deferred = append(res.Deferred, i)
	}
	return res
}

// NetPayout is the batch's frozen payout:
// gross - fee - refunds + feeReversed.
func NetPayout(grossFils, feeFils, refundFils, feeReversedFils money.Fils) money.Fils {
	return grossFils - feeFils - refundFils + feeReversedFils
}
