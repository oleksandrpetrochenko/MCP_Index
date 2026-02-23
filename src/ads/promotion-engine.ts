import { promotionRepo } from "../db/promotion-repo.js";
import { partnerRepo } from "../db/partner-repo.js";
import { revenueService } from "./revenue-service.js";

export interface PromotedResult {
  sponsored: true;
  promotionId: string;
  server: {
    name: string;
    slug: string;
    description: string | null;
    qualityScore: number | null;
    stars: number | null;
    weeklyDownloads: number | null;
    category?: { name: string; slug: string } | null;
  };
}

/**
 * Core orchestrator: matches active promotions to search queries,
 * records impressions, and returns promoted results to inject into search responses.
 */
export const promotionEngine = {
  /**
   * Get promoted results for a search query.
   * Only returns results if partnerKey is valid, partner is active, and opted in.
   * Returns empty array for non-partner or non-opted-in calls.
   */
  async getPromotedResults(options: {
    query?: string;
    categorySlug?: string;
    partnerKey?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<PromotedResult[]> {
    const { query, categorySlug, partnerKey, sessionId, limit = 2 } = options;

    // No partner key = no promoted results
    if (!partnerKey) return [];

    // Validate partner
    const partner = await partnerRepo.findByApiKey(partnerKey);
    if (!partner || partner.status !== "active" || !partner.includePromoted) {
      return [];
    }

    // Tokenize query for keyword matching
    const queryTokens = query
      ? query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 1)
      : undefined;

    // Find matching promotions
    const matches = await promotionRepo.findMatchingPromotions({
      queryTokens,
      categorySlug,
      limit,
    });

    if (matches.length === 0) return [];

    // Record impressions and revenue for each match
    const results: PromotedResult[] = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];

      // Record impression
      const impression = await promotionRepo.recordImpression({
        promotionId: match.promotion.id,
        partnerPlatformId: partner.id,
        sessionId,
        searchQuery: query,
        position: i,
      });

      // Record revenue for impression
      await revenueService.recordImpressionRevenue({
        promotionId: match.promotion.id,
        partnerPlatformId: partner.id,
        costPerImpressionCents: match.promotion.costPerImpressionCents,
        partnerRevenueSharePercent: partner.revenueSharePercent,
        referenceId: impression.id,
      });

      results.push({
        sponsored: true,
        promotionId: match.promotion.id,
        server: {
          name: match.server.name,
          slug: match.server.slug,
          description: match.server.description,
          qualityScore: match.server.qualityScore,
          stars: match.server.stars,
          weeklyDownloads: match.server.weeklyDownloads,
        },
      });
    }

    return results;
  },

  /**
   * Record a click event (called when get_server or report_ad_interaction is used).
   */
  async recordClick(options: {
    promotionId: string;
    serverSlug: string;
    partnerKey?: string;
    impressionId?: string;
    clickType?: string;
  }) {
    const { promotionId, serverSlug, partnerKey, impressionId, clickType } =
      options;

    let partnerPlatformId: string | undefined;
    let partnerSharePercent = 0;

    if (partnerKey) {
      const partner = await partnerRepo.findByApiKey(partnerKey);
      if (partner && partner.status === "active") {
        partnerPlatformId = partner.id;
        partnerSharePercent = partner.revenueSharePercent;
      }
    }

    // Record click
    const click = await promotionRepo.recordClick({
      impressionId,
      promotionId,
      partnerPlatformId,
      serverSlug,
      clickType: clickType || "detail",
    });

    // Get promotion to know CPC
    const promotion = await promotionRepo.findById(promotionId);
    if (!promotion) return click;

    // Record revenue for click
    await revenueService.recordClickRevenue({
      promotionId,
      partnerPlatformId,
      costPerClickCents: promotion.costPerClickCents,
      partnerRevenueSharePercent: partnerSharePercent,
      referenceId: click.id,
    });

    return click;
  },

  /**
   * Format promoted results as markdown for MCP tool responses.
   */
  formatPromotedMarkdown(promoted: PromotedResult[]): string {
    if (promoted.length === 0) return "";

    const lines = promoted.map((p) => {
      const cat = p.server.category ? ` [${p.server.category.name}]` : "";
      return `- **[Sponsored]** **${p.server.name}**${cat} (score: ${p.server.qualityScore || 0}, stars: ${p.server.stars || 0})\n  ${p.server.description || "No description"}\n  Slug: \`${p.server.slug}\``;
    });

    return lines.join("\n\n") + "\n\n---\n\n";
  },
};
