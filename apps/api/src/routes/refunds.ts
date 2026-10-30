import type { FastifyInstance, FastifyRequest } from "fastify";
import { toFils } from "@filspay/money";
import { requireMerchantAuth, requireMerchantRole, requireMerchantWriterActor } from "../auth/requireMerchantAuth.js";
import { initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError, ForbiddenError } from "../lib/errors.js";

interface CreateRefundBody {
  transactionId?: unknown;
  amountFils?: unknown;
  reason?: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 200;

/** Same contract as the capture route: the caller supplies the key, so a retry replays instead of refunding twice. */
function getIdempotencyKey(request: FastifyRequest): string {
  const header = request.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
  }
  return key;
}

/**
 * `POST /v1/refunds` (registered with prefix '/v1/refunds').
 *
 * Body: `{ transactionId, amountFils?, reason? }`. Omitting `amountFils`
 * refunds everything still refundable. The merchant is taken only from the
 * authenticated session / API key, never from the body.
 *
 * Who may refund: API keys (owner-issued, full merchant authority) and
 * session users with the owner or finance role - the same set the dashboard's
 * refund drawer is shown to. An operator's "view as merchant" grant is
 * read-only by design and is refused outright, whatever role it maps to.
 */
export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateRefundBody }>(
    "/",
    { preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
    async (request, reply) => {
      const auth = request.merchantAuth!;
      if (auth.actorType === "admin_impersonation") {
        throw new ForbiddenError("forbidden");
      }

      const idempotencyKey = getIdempotencyKey(request);
      const { transactionId, amountFils, reason } = request.body ?? {};

      if (typeof transactionId !== "string" || !UUID_RE.test(transactionId)) {
        throw new BadRequestError("invalid_request", "transactionId must be a transaction id");
      }
      if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)) {
        throw new BadRequestError("invalid_request", `reason must be a string of at most ${MAX_REASON_LENGTH} characters`);
      }

      let amount;
      if (amountFils !== undefined) {
        try {
          amount = toFils(amountFils as number);
        } catch {
          throw new BadRequestError("invalid_request", "amountFils must be an integer number of fils");
        }
      }

      const result = await initiateMerchantRefund(app.db, app.acquirer, {
        merchantId: auth.merchantId,
        transactionId,
        amountFils: amount,
        idempotencyKey,
        actor: requireMerchantWriterActor(auth),
        reason,
      });
      reply.code(result.statusCode).send(result.body);
    },
  );
}
