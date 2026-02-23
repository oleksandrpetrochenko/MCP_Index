import type { FastifyInstance } from "fastify";
import { advertiserRepo } from "../../db/advertiser-repo.js";
import { promotionRepo } from "../../db/promotion-repo.js";
import { advertiserAuthHook } from "../middleware/advertiser-auth.js";

export async function advertiserRoutes(app: FastifyInstance): Promise<void> {
  // Public: Register as a new advertiser (status: pending, requires admin approval)
  app.post<{
    Body: { name: string; email: string };
  }>("/register", async (request, reply) => {
    const { name, email } = request.body || {};

    if (!name || !email) {
      return reply.code(400).send({ error: "name and email are required" });
    }

    const existing = await advertiserRepo.findByEmail(email);
    if (existing) {
      return reply
        .code(409)
        .send({ error: "An advertiser with this email already exists" });
    }

    const advertiser = await advertiserRepo.create({ name, email });

    return reply.code(201).send({
      id: advertiser.id,
      name: advertiser.name,
      apiKey: advertiser.apiKey,
      status: advertiser.status,
      message:
        "Registration received. Your account is pending approval. Save your API key — it won't be shown again.",
    });
  });

  // Authenticated advertiser routes
  app.register(async (authed) => {
    authed.addHook("onRequest", advertiserAuthHook);

    // Get own profile
    authed.get("/me", async (request) => {
      return {
        id: request.advertiser!.id,
        name: request.advertiser!.name,
        email: request.advertiser!.email,
        status: request.advertiser!.status,
      };
    });

    // Create a promotion
    authed.post<{
      Body: {
        serverId: string;
        dailyBudgetCents?: number;
        totalBudgetCents?: number;
        costPerImpressionCents?: number;
        costPerClickCents?: number;
        targetCategories?: string[];
        targetKeywords?: string[];
        priority?: number;
        expiresAt?: string;
      };
    }>("/promotions", async (request, reply) => {
      const body = request.body || {};

      if (!body.serverId) {
        return reply.code(400).send({ error: "serverId is required" });
      }

      const promotion = await promotionRepo.create({
        advertiserId: request.advertiser!.id,
        serverId: body.serverId,
        dailyBudgetCents: body.dailyBudgetCents,
        totalBudgetCents: body.totalBudgetCents,
        costPerImpressionCents: body.costPerImpressionCents,
        costPerClickCents: body.costPerClickCents,
        targetCategories: body.targetCategories,
        targetKeywords: body.targetKeywords,
        priority: body.priority,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      return reply.code(201).send(promotion);
    });

    // List own promotions
    authed.get("/promotions", async (request) => {
      const promotions = await promotionRepo.findByAdvertiser(
        request.advertiser!.id,
      );
      return { promotions };
    });

    // Get promotion stats
    authed.get<{ Params: { promotionId: string } }>(
      "/promotions/:promotionId/stats",
      async (request, reply) => {
        const { promotionId } = request.params;

        const promotion = await promotionRepo.findById(promotionId);
        if (!promotion) {
          return reply.code(404).send({ error: "Promotion not found" });
        }
        if (promotion.advertiserId !== request.advertiser!.id) {
          return reply.code(403).send({ error: "Not your promotion" });
        }

        const [revenue, impressions, clicks] = await Promise.all([
          promotionRepo.getRevenueByPromotion(promotionId),
          promotionRepo.getImpressionCount(promotionId),
          promotionRepo.getClickCount(promotionId),
        ]);

        return {
          promotionId,
          status: promotion.status,
          spentCents: promotion.spentCents,
          dailyBudgetCents: promotion.dailyBudgetCents,
          totalBudgetCents: promotion.totalBudgetCents,
          totalImpressions: impressions,
          totalClicks: clicks,
          ctr:
            impressions > 0
              ? ((clicks / impressions) * 100).toFixed(2) + "%"
              : "0%",
          totalGrossCents: Number(revenue.totalGross),
        };
      },
    );

    // Pause/resume a promotion
    authed.patch<{
      Params: { promotionId: string };
      Body: { status: string };
    }>("/promotions/:promotionId", async (request, reply) => {
      const { promotionId } = request.params;
      const { status } = request.body || {};

      if (!status || !["active", "paused"].includes(status)) {
        return reply
          .code(400)
          .send({ error: "status must be 'active' or 'paused'" });
      }

      const promotion = await promotionRepo.findById(promotionId);
      if (!promotion) {
        return reply.code(404).send({ error: "Promotion not found" });
      }
      if (promotion.advertiserId !== request.advertiser!.id) {
        return reply.code(403).send({ error: "Not your promotion" });
      }

      await promotionRepo.updateStatus(promotionId, status);
      return { promotionId, status };
    });
  });
}
