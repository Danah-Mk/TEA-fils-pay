package settlement

import "testing"

func TestVolumeTierMdrBonusBps_AcceptsInt64Volume(t *testing.T) {
	// Lifetime volume can exceed int32 (≈2.147e9 fils). The threshold is
	// 2e9, so a 3e9 reading must still grant the bonus.
	if got := VolumeTierMdrBonusBps(3_000_000_000); got != 15 {
		t.Errorf("VolumeTierMdrBonusBps(3e9) = %d, want 15", got)
	}
}
