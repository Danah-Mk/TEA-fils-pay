package scheduler

import (
	"testing"
	"time"
)

func TestBusinessDateIfDue_RunsAtBahrainDelayNotUTC(t *testing.T) {
	const delay = 15
	loc := bahrainLocation

	// 00:14 Bahrain: still inside the grace period.
	tooEarly := time.Date(2026, 10, 30, 0, 14, 0, 0, loc)
	if _, due := businessDateIfDue(tooEarly, delay); due {
		t.Fatal("00:14 Bahrain must not be due with a 15-minute delay")
	}

	// 00:15 Bahrain: close yesterday's Bahrain business day.
	onTime := time.Date(2026, 10, 30, 0, 15, 0, 0, loc)
	got, due := businessDateIfDue(onTime, delay)
	if !due {
		t.Fatal("00:15 Bahrain must be due with a 15-minute delay")
	}
	want := time.Date(2026, 10, 29, 0, 0, 0, 0, loc)
	if got.Year() != want.Year() || got.Month() != want.Month() || got.Day() != want.Day() {
		t.Errorf("business date = %s, want 2026-10-29 Bahrain", got.Format("2006-01-02"))
	}

	// 21:15 UTC 29 Oct is 00:15 Bahrain 30 Oct. Passing a UTC instant must
	// still close 29 Oct, not 28 Oct (the UTC-calendar bug).
	utcEquivalent := time.Date(2026, 10, 29, 21, 15, 0, 0, time.UTC)
	got, due = businessDateIfDue(utcEquivalent, delay)
	if !due {
		t.Fatal("21:15 UTC (00:15 Bahrain) must be due")
	}
	if got.Year() != want.Year() || got.Month() != want.Month() || got.Day() != want.Day() {
		t.Errorf("UTC instant business date = %s, want 2026-10-29 (Bahrain yesterday)", got.Format("2006-01-02"))
	}
}
