import { eq, and, sql, lte, gte, or, desc } from "drizzle-orm";
import { db } from "../config/database.js";
import {
  promotions,
  adImpressions,
  adClicks,
  revenueLedger,
  mcpServers,
} from "./schema.js";

export interface CreatePromotionInput {
  advertiserId: string;
  serverId: string;
  dailyBudgetCents?: number;
  totalBudgetCents?: number;
  costPerImpressionCents?: number;
  costPerClickCents?: number;
  targetCategories?: string[];
  targetKeywords?: string[];
  priority?: number;
  startsAt?: Date;
  expiresAt?: Date;
}

export interface RecordImpressionInput {
  promotionId: string;
  partnerPlatformId?: string;
  sessionId?: string;
  searchQuery?: string;
  position: number;
}

export interface RecordClickInput {
  impressionId?: string;
  promotionId: string;
  partnerPlatformId?: string;
  serverSlug: string;
  clickType?: string;
}

export const promotionRepo = {
  async create(input: CreatePromotionInput) {
    const [result] = await db
      .insert(promotions)
      .values(input)
      .returning();
    return result;
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id))
      .limit(1);
    return result;
  },

  async findByAdvertiser(advertiserId: string) {
    return db
      .select()
      .from(promotions)
      .where(eq(promotions.advertiserId, advertiserId))
      .orderBy(desc(promotions.createdAt));
  },

  async updateStatus(id: string, status: string) {
    await db
      .update(promotions)
      .set({ status, updatedAt: new Date() })
      .where(eq(promotions.id, id));
  },

  /**
   * Find active promotions matching a search query.
   * Matches by: targetKeywords overlapping query tokens, OR targetCategories matching, OR run-of-network (both null).
   * Filters: status=active, within date range, under total budget.
   * Orders by priority DESC, then random for fairness.
   */
  async findMatchingPromotions(options: {
    queryTokens?: string[];
    categorySlug?: string;
    limit?: number;
  }) {
    const { queryTokens, categorySlug, limit = 2 } = options;
    const now = new Date();

    const conditions = [
      eq(promotions.status, "active"),
      lte(promotions.startsAt, now),
      or(
        sql`${promotions.expiresAt} IS NULL`,
        gte(promotions.expiresAt, now),
      ),
      sql`${promotions.spentCents} < ${promotions.totalBudgetCents}`,
    ];

    // Build keyword/category/run-of-network matching
    const targetConditions = [];

    if (queryTokens && queryTokens.length > 0) {
      // targetKeywords overlaps with query tokens
      targetConditions.push(
        sql`${promotions.targetKeywords} ?| array[${sql.join(
          queryTokens.map((t) => sql`${t}`),
          sql`, `,
        )}]`,
      );
    }

    if (categorySlug) {
      targetConditions.push(
        sql`${promotions.targetCategories} ? ${categorySlug}`,
      );
    }

    // Run-of-network: both targetKeywords and targetCategories are null
    targetConditions.push(
      and(
        sql`${promotions.targetKeywords} IS NULL`,
        sql`${promotions.targetCategories} IS NULL`,
      )!,
    );

    conditions.push(or(...targetConditions)!);

    const results = await db
      .select({
        promotion: promotions,
        server: mcpServers,
      })
      .from(promotions)
      .innerJoin(mcpServers, eq(promotions.serverId, mcpServers.id))
      .where(and(...conditions))
      .orderBy(desc(promotions.priority), sql`random()`)
      .limit(limit);

    return results;
  },

  async recordImpression(input: RecordImpressionInput) {
    const [result] = await db
      .insert(adImpressions)
      .values(input)
      .returning();
    return result;
  },

  async recordClick(input: RecordClickInput) {
    const [result] = await db
      .insert(adClicks)
      .values(input)
      .returning();
    return result;
  },

  async addToSpent(promotionId: string, amountCents: number) {
    await db
      .update(promotions)
      .set({
        spentCents: sql`${promotions.spentCents} + ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, promotionId));
  },

  async recordRevenue(entry: {
    promotionId: string;
    partnerPlatformId?: string;
    eventType: string;
    grossAmountCents: number;
    partnerShareCents: number;
    netAmountCents: number;
    referenceId?: string;
  }) {
    const [result] = await db
      .insert(revenueLedger)
      .values(entry)
      .returning();
    return result;
  },

  async getRevenueByPartner(partnerPlatformId: string) {
    const [result] = await db
      .select({
        totalGross: sql<number>`coalesce(sum(${revenueLedger.grossAmountCents}), 0)`,
        totalPartnerShare: sql<number>`coalesce(sum(${revenueLedger.partnerShareCents}), 0)`,
        totalNet: sql<number>`coalesce(sum(${revenueLedger.netAmountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(revenueLedger)
      .where(eq(revenueLedger.partnerPlatformId, partnerPlatformId));
    return result;
  },

  async getRevenueByPromotion(promotionId: string) {
    const [result] = await db
      .select({
        totalGross: sql<number>`coalesce(sum(${revenueLedger.grossAmountCents}), 0)`,
        totalImpressions: sql<number>`count(*) filter (where ${revenueLedger.eventType} = 'impression')`,
        totalClicks: sql<number>`count(*) filter (where ${revenueLedger.eventType} = 'click')`,
      })
      .from(revenueLedger)
      .where(eq(revenueLedger.promotionId, promotionId));
    return result;
  },

  async getImpressionCount(promotionId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adImpressions)
      .where(eq(adImpressions.promotionId, promotionId));
    return Number(result.count);
  },

  async getClickCount(promotionId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adClicks)
      .where(eq(adClicks.promotionId, promotionId));
    return Number(result.count);
  },
};
