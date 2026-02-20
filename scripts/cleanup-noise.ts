#!/usr/bin/env node
/**
 * Removes non-MCP packages from the database.
 * Uses the same isMcpPackage() logic as the NPM crawler filter.
 * Related child rows (tools, resources, prompts) are cascade-deleted.
 */
import "dotenv/config";
import { db } from "../src/config/database.js";
import { mcpServers } from "../src/db/schema.js";
import { eq, sql } from "drizzle-orm";

const MCP_INDICATORS = [
  "mcp",
  "model-context-protocol",
  "model context protocol",
  "modelcontextprotocol",
  "mcp-server",
  "mcp-tool",
  "mcp-resource",
];

function isMcpEntry(server: {
  name: string;
  slug: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  repositoryUrl: string | null;
}): boolean {
  const name = server.name.toLowerCase();
  const slug = server.slug.toLowerCase();
  const desc = (server.description || "").toLowerCase();
  const repoUrl = (server.repositoryUrl || "").toLowerCase();

  // Check name/slug
  if (MCP_INDICATORS.some((ind) => name.includes(ind))) return true;
  if (MCP_INDICATORS.some((ind) => slug.includes(ind))) return true;

  // Check metadata keywords (from NPM crawler)
  const meta = server.metadata || {};
  const keywords: string[] = ((meta.keywords as string[]) || []).map((k: string) =>
    k.toLowerCase(),
  );
  if (keywords.some((kw) => MCP_INDICATORS.some((ind) => kw.includes(ind)))) return true;

  // Check metadata source — awesome-list entries are curated, keep them
  if (meta.source === "awesome-list") return true;
  if (meta.source === "github") return true;

  // Check description
  if (
    desc.includes("model context protocol") ||
    desc.includes("mcp server") ||
    desc.includes("mcp tool") ||
    desc.includes("mcp client") ||
    desc.includes("mcp resource") ||
    desc.includes("mcp prompt") ||
    /\bmcp\b/.test(desc)
  ) {
    return true;
  }

  // Check repo URL for MCP-related paths
  if (repoUrl.includes("mcp") || repoUrl.includes("model-context-protocol")) return true;

  return false;
}

async function main() {
  console.log("Scanning database for non-MCP entries...\n");

  const allServers = await db
    .select({
      id: mcpServers.id,
      name: mcpServers.name,
      slug: mcpServers.slug,
      description: mcpServers.description,
      metadata: mcpServers.metadata,
      repositoryUrl: mcpServers.repositoryUrl,
    })
    .from(mcpServers);

  console.log(`Total servers in database: ${allServers.length}`);

  const noise: typeof allServers = [];
  const kept: typeof allServers = [];

  for (const server of allServers) {
    if (isMcpEntry(server)) {
      kept.push(server);
    } else {
      noise.push(server);
    }
  }

  console.log(`MCP-related (keeping): ${kept.length}`);
  console.log(`Non-MCP noise (removing): ${noise.length}\n`);

  if (noise.length === 0) {
    console.log("No noise entries found. Database is clean!");
    process.exit(0);
  }

  // Show sample of what will be removed
  console.log("Sample noise entries to be removed:");
  for (const entry of noise.slice(0, 20)) {
    console.log(`  - ${entry.name}: ${(entry.description || "").slice(0, 80)}`);
  }
  if (noise.length > 20) {
    console.log(`  ... and ${noise.length - 20} more\n`);
  }

  // Check for --dry-run flag
  if (process.argv.includes("--dry-run")) {
    console.log("\n[DRY RUN] No changes made. Remove --dry-run to delete noise entries.");
    process.exit(0);
  }

  // Delete noise entries (cascade will handle tools/resources/prompts)
  console.log("\nDeleting noise entries...");
  let deleted = 0;
  for (const entry of noise) {
    await db.delete(mcpServers).where(eq(mcpServers.id, entry.id));
    deleted++;
    if (deleted % 100 === 0) {
      console.log(`  Deleted ${deleted}/${noise.length}...`);
    }
  }

  console.log(`\nDone! Deleted ${deleted} non-MCP entries.`);

  // Final count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mcpServers);
  console.log(`Remaining servers: ${Number(count)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
