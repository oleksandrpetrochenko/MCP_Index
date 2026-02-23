import { eq, sql, and, lte } from "drizzle-orm";
import { db } from "../config/database.js";
import { promotions, adImpressions, adClicks } from "../db/schema.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("ad-budget-jobs");

/**
 * Check all active promotions and exhaust those that have exceeded their total budget.
 */
export async function checkBudgetExhaustion(): Promise<number> {
  log.info("Checking promotion budgets...");

  const exhausted = await db
    .update(promotions)
    .set({ status: "exhausted", updatedAt: new Date() })
    .where(
      and(
        eq(promotions.status, "active"),
        sql`${promotions.spentCents} >= ${promotions.totalBudgetCents}`,
      ),
    )
    .returning({ id: promotions.id });

  if (exhausted.length > 0) {
    log.info({ count: exhausted.length }, "Promotions exhausted budget");
  }

  return exhausted.length;
}

/**
 * Expire promotions past their expiresAt date.
 */
export async function expirePromotions(): Promise<number> {
  const now = new Date();

  const expired = await db
    .update(promotions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(promotions.status, "active"),
        lte(promotions.expiresAt, now),
      ),
    )
    .returning({ id: promotions.id });

  if (expired.length > 0) {
    log.info({ count: expired.length }, "Promotions expired");
  }

  return expired.length;
}

/**
 * Clean up old impression/click records (older than 90 days).
 */
export async function cleanupOldAdEvents(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const impressionsDeleted = await db
    .delete(adImpressions)
    .where(sql`${adImpressions.createdAt} < ${ninetyDaysAgo}`)
    .returning({ id: adImpressions.id });

  const clicksDeleted = await db
    .delete(adClicks)
    .where(sql`${adClicks.createdAt} < ${ninetyDaysAgo}`)
    .returning({ id: adClicks.id });

  if (impressionsDeleted.length > 0 || clicksDeleted.length > 0) {
    log.info(
      {
        impressions: impressionsDeleted.length,
        clicks: clicksDeleted.length,
      },
      "Cleaned up old ad events",
    );
  }
}

/**
 * Run all ad budget maintenance tasks.
 */
export async function runAdMaintenance(): Promise<void> {
  log.info("Running ad maintenance tasks");

  await checkBudgetExhaustion();
  await expirePromotions();
  await cleanupOldAdEvents();

  log.info("Ad maintenance complete");
}
