import type { FastifyInstance } from "fastify";
import { partnerRepo } from "../../db/partner-repo.js";
import { promotionRepo } from "../../db/promotion-repo.js";
import { promotionEngine } from "../../ads/promotion-engine.js";
import { partnerAuthHook } from "../middleware/partner-auth.js";

export async function partnerRoutes(app: FastifyInstance): Promise<void> {
  // Public: Register as a new partner (status: pending, requires admin approval)
  app.post<{
    Body: { name: string; contactEmail: string; callbackUrl?: string };
  }>("/register", async (request, reply) => {
    const { name, contactEmail, callbackUrl } = request.body || {};

    if (!name || !contactEmail) {
      return reply
        .code(400)
        .send({ error: "name and contactEmail are required" });
    }

    const partner = await partnerRepo.create({
      name,
      contactEmail,
      callbackUrl,
    });

    return reply.code(201).send({
      id: partner.id,
      name: partner.name,
      apiKey: partner.apiKey,
      status: partner.status,
      message:
        "Registration received. Your account is pending approval. Save your API key — it won't be shown again.",
    });
  });

  // Authenticated partner routes
  app.register(async (authed) => {
    authed.addHook("onRequest", partnerAuthHook);

    // Get own profile
    authed.get("/me", async (request) => {
      return {
        id: request.partner!.id,
        name: request.partner!.name,
        status: request.partner!.status,
        tier: request.partner!.tier,
        revenueSharePercent: request.partner!.revenueSharePercent,
        includePromoted: request.partner!.includePromoted,
      };
    });

    // Opt in/out of promoted results
    authed.patch<{ Body: { includePromoted: boolean } }>(
      "/me",
      async (request, reply) => {
        const { includePromoted } = request.body || {};
        if (typeof includePromoted !== "boolean") {
          return reply
            .code(400)
            .send({ error: "includePromoted (boolean) is required" });
        }

        await partnerRepo.setIncludePromoted(
          request.partner!.id,
          includePromoted,
        );

        return {
          includePromoted,
          message: includePromoted
            ? "You will now receive promoted results in MCP tool responses."
            : "Promoted results disabled.",
        };
      },
    );

    // Get revenue summary
    authed.get("/me/revenue", async (request) => {
      const revenue = await promotionRepo.getRevenueByPartner(
        request.partner!.id,
      );

      return {
        partnerId: request.partner!.id,
        revenueSharePercent: request.partner!.revenueSharePercent,
        totalGrossCents: Number(revenue.totalGross),
        totalPartnerShareCents: Number(revenue.totalPartnerShare),
        totalNetCents: Number(revenue.totalNet),
        totalEvents: Number(revenue.count),
      };
    });

    // Report a click/interaction (REST alternative to MCP tool)
    authed.post<{
      Body: {
        serverSlug: string;
        promotionId: string;
        impressionId?: string;
        clickType?: string;
      };
    }>("/report-click", async (request, reply) => {
      const { serverSlug, promotionId, impressionId, clickType } =
        request.body || {};

      if (!serverSlug || !promotionId) {
        return reply
          .code(400)
          .send({ error: "serverSlug and promotionId are required" });
      }

      const partner = await partnerRepo.findById(request.partner!.id);
      if (!partner) {
        return reply.code(404).send({ error: "Partner not found" });
      }

      await promotionEngine.recordClick({
        promotionId,
        serverSlug,
        partnerKey: partner.apiKey,
        impressionId,
        clickType: clickType || "detail",
      });

      return { recorded: true };
    });
  });
}
