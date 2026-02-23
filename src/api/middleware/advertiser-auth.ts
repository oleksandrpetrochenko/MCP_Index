import type { FastifyRequest, FastifyReply } from "fastify";
import { advertiserRepo } from "../../db/advertiser-repo.js";

declare module "fastify" {
  interface FastifyRequest {
    advertiser?: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  }
}

/**
 * Advertiser authentication hook.
 * Expects x-advertiser-key header. Sets request.advertiser if valid.
 */
export async function advertiserAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const apiKey = request.headers["x-advertiser-key"] as string | undefined;
  if (!apiKey) {
    return reply.code(401).send({ error: "Missing x-advertiser-key header" });
  }

  const advertiser = await advertiserRepo.findByApiKey(apiKey);
  if (!advertiser) {
    return reply.code(401).send({ error: "Invalid advertiser API key" });
  }

  if (advertiser.status !== "active") {
    return reply
      .code(403)
      .send({ error: `Advertiser account is ${advertiser.status}` });
  }

  request.advertiser = {
    id: advertiser.id,
    name: advertiser.name,
    email: advertiser.email,
    status: advertiser.status,
  };
}
