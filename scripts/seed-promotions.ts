/**
 * Seed test data for the ad network.
 * Creates a test advertiser, partner, and promotion for development.
 *
 * Usage: npx tsx scripts/seed-promotions.ts
 */
import "dotenv/config";
import { db } from "../src/config/database.js";
import { advertiserRepo } from "../src/db/advertiser-repo.js";
import { partnerRepo } from "../src/db/partner-repo.js";
import { promotionRepo } from "../src/db/promotion-repo.js";
import { mcpServers } from "../src/db/schema.js";
import { desc } from "drizzle-orm";

async function seed() {
  console.log("Seeding ad network test data...\n");

  // 1. Create test advertiser
  let advertiser = await advertiserRepo.findByEmail("test@advertiser.dev");
  if (!advertiser) {
    advertiser = await advertiserRepo.create({
      name: "Test Advertiser",
      email: "test@advertiser.dev",
    });
    await advertiserRepo.updateStatus(advertiser.id, "active");
    console.log(`Created advertiser: ${advertiser.name}`);
    console.log(`  API Key: ${advertiser.apiKey}`);
  } else {
    console.log(`Advertiser already exists: ${advertiser.name}`);
  }

  // 2. Create test partner
  const existingPartner = await partnerRepo.findByApiKey("");
  let partner;
  try {
    partner = await partnerRepo.create({
      name: "Test Chatbot Platform",
      contactEmail: "test@partner.dev",
    });
    await partnerRepo.updateStatus(partner.id, "active");
    await partnerRepo.setIncludePromoted(partner.id, true);
    console.log(`Created partner: ${partner.name}`);
    console.log(`  API Key: ${partner.apiKey}`);
  } catch {
    console.log("Partner may already exist, continuing...");
  }

  // 3. Pick a top server to promote
  const topServers = await db
    .select({ id: mcpServers.id, name: mcpServers.name, slug: mcpServers.slug })
    .from(mcpServers)
    .orderBy(desc(mcpServers.qualityScore))
    .limit(3);

  if (topServers.length === 0) {
    console.log("No servers in database — run a crawl first.");
    process.exit(0);
  }

  // 4. Create test promotions
  for (const server of topServers) {
    const promotion = await promotionRepo.create({
      advertiserId: advertiser.id,
      serverId: server.id,
      dailyBudgetCents: 500, // $5/day
      totalBudgetCents: 15000, // $150 total
      costPerImpressionCents: 1, // $0.01
      costPerClickCents: 10, // $0.10
      targetKeywords: ["database", "github", "api", "tools"],
      priority: 1,
    });
    console.log(`Created promotion for "${server.name}" (${promotion.id})`);
  }

  console.log("\nSeed complete.");
  console.log("\nTo test:");
  console.log("1. Start server: pnpm dev");
  console.log("2. Call search_servers with partnerKey to see [Sponsored] results");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
