import { sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { mcpServers, crawlJobs } from "../db/schema.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("maintenance");

/**
 * Clean up stale data:
 * - Remove servers not crawled in 30 days
 * - Remove old completed crawl jobs (older than 7 days)
 */
export async function runMaintenance(): Promise<void> {
  log.info("Running maintenance tasks");

  // Mark servers stale if not crawled in 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const staleResult = await db
    .delete(mcpServers)
    .where(sql`${mcpServers.lastCrawledAt} < ${thirtyDaysAgo}`)
    .returning({ id: mcpServers.id });

  if (staleResult.length > 0) {
    log.info({ count: staleResult.length }, "Removed stale servers");
  }

  // Clean up old crawl jobs
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const jobsResult = await db
    .delete(crawlJobs)
    .where(sql`${crawlJobs.completedAt} < ${sevenDaysAgo}`)
    .returning({ id: crawlJobs.id });

  if (jobsResult.length > 0) {
    log.info({ count: jobsResult.length }, "Cleaned up old crawl jobs");
  }

  log.info("Maintenance complete");
}
