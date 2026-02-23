import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { partnerRepo } from "../../db/partner-repo.js";

declare module "fastify" {
  interface FastifyRequest {
    partner?: {
      id: string;
      name: string;
      status: string;
      tier: string;
      revenueSharePercent: number;
      includePromoted: boolean;
    };
  }
}

/**
 * Partner authentication hook.
 * Expects x-partner-key header. Sets request.partner if valid.
 */
export async function partnerAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const apiKey = request.headers["x-partner-key"] as string | undefined;
  if (!apiKey) {
    return reply.code(401).send({ error: "Missing x-partner-key header" });
  }

  const partner = await partnerRepo.findByApiKey(apiKey);
  if (!partner) {
    return reply.code(401).send({ error: "Invalid partner API key" });
  }

  if (partner.status !== "active") {
    return reply
      .code(403)
      .send({ error: `Partner account is ${partner.status}` });
  }

  request.partner = {
    id: partner.id,
    name: partner.name,
    status: partner.status,
    tier: partner.tier,
    revenueSharePercent: partner.revenueSharePercent,
    includePromoted: partner.includePromoted,
  };
}
