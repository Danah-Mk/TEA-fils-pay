package settlement

import "github.com/filspay/settlement/internal/money"

// NetPayableFils derives the net payout from frozen gross and fee totals.
//
// Plain integer subtraction. It used to go through float32 BD values
// ("gross/1000 - fee/1000"), which has a 24-bit mantissa: from roughly
// BD 16,000 of gross the payout drifted by a fil or more (the "payouts a few
// fils off" support tickets).
func NetPayableFils(grossFils, feeFils money.Fils) money.Fils {
	return grossFils - feeFils
}
