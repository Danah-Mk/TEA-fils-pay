import type { PoolClient } from "pg";

/**
 * Used to clear merchants.test_mode when a recompute found no open authorizations. That says nothing about
 * whether a merchant is live, and it flipped sandbox merchants to settleable. test_mode is only ever changed by
 * an explicit, audited decision, so this now reports nothing and changes nothing.
 */
export async function reconcileSandboxFlag(
  client: PoolClient,
  merchantId: string,
  summary: { scanned: number; openAuthorizations: number },
): Promise<string[]> {
  void client;
  void merchantId;
  void summary;
  return [];
}
