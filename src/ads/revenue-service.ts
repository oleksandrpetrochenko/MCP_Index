import { promotionRepo } from "../db/promotion-repo.js";

/**
 * Revenue calculation and recording service.
 * Handles revenue share computation and budget enforcement.
 */
export const revenueService = {
  /**
   * Record revenue from an impression event.
   */
  async recordImpressionRevenue(params: {
    promotionId: string;
    partnerPlatformId?: string;
    costPerImpressionCents: number;
    partnerRevenueSharePercent: number;
    referenceId: string;
  }) {
    const {
      promotionId,
      partnerPlatformId,
      costPerImpressionCents,
      partnerRevenueSharePercent,
      referenceId,
    } = params;

    const grossAmount = costPerImpressionCents;
    const partnerShare = partnerPlatformId
      ? Math.floor((grossAmount * partnerRevenueSharePercent) / 100)
      : 0;
    const netAmount = grossAmount - partnerShare;

    // Record ledger entry
    await promotionRepo.recordRevenue({
      promotionId,
      partnerPlatformId,
      eventType: "impression",
      grossAmountCents: grossAmount,
      partnerShareCents: partnerShare,
      netAmountCents: netAmount,
      referenceId,
    });

    // Update spent on promotion
    await promotionRepo.addToSpent(promotionId, grossAmount);
  },

  /**
   * Record revenue from a click event.
   */
  async recordClickRevenue(params: {
    promotionId: string;
    partnerPlatformId?: string;
    costPerClickCents: number;
    partnerRevenueSharePercent: number;
    referenceId: string;
  }) {
    const {
      promotionId,
      partnerPlatformId,
      costPerClickCents,
      partnerRevenueSharePercent,
      referenceId,
    } = params;

    const grossAmount = costPerClickCents;
    const partnerShare = partnerPlatformId
      ? Math.floor((grossAmount * partnerRevenueSharePercent) / 100)
      : 0;
    const netAmount = grossAmount - partnerShare;

    // Record ledger entry
    await promotionRepo.recordRevenue({
      promotionId,
      partnerPlatformId,
      eventType: "click",
      grossAmountCents: grossAmount,
      partnerShareCents: partnerShare,
      netAmountCents: netAmount,
      referenceId,
    });

    // Update spent on promotion
    await promotionRepo.addToSpent(promotionId, grossAmount);
  },

  /**
   * Calculate revenue share breakdown for display.
   */
  calculateShare(grossCents: number, sharePercent: number) {
    const partnerShare = Math.floor((grossCents * sharePercent) / 100);
    return {
      grossCents,
      partnerShareCents: partnerShare,
      netCents: grossCents - partnerShare,
    };
  },
};
