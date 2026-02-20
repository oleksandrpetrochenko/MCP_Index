import "dotenv/config";
import { db } from "../src/config/database.js";
import { categories } from "../src/db/schema.js";
import { sourceRepo } from "../src/db/source-repo.js";
import { defaultSources } from "../src/config/sources.js";
import { logger } from "../src/utils/logger.js";

const defaultCategories = [
  { name: "Developer Tools", slug: "developer-tools", description: "Code editing, debugging, version control" },
  { name: "Data & Databases", slug: "data-databases", description: "Database access, data processing" },
  { name: "Cloud & Infrastructure", slug: "cloud-infrastructure", description: "Cloud services, deployment, monitoring" },
  { name: "AI & Machine Learning", slug: "ai-ml", description: "AI services, embeddings, LLM integration" },
  { name: "Communication", slug: "communication", description: "Email, messaging, notifications" },
  { name: "File Systems", slug: "file-systems", description: "File operations, storage, search" },
  { name: "Web & APIs", slug: "web-apis", description: "Web scraping, REST APIs, webhooks" },
  { name: "Productivity", slug: "productivity", description: "Note-taking, calendar, task management" },
  { name: "Security", slug: "security", description: "Auth, encryption, vulnerability scanning" },
  { name: "Other", slug: "other", description: "Miscellaneous MCP servers" },
];

async function seed() {
  logger.info("Seeding database...");

  // Seed categories
  for (const cat of defaultCategories) {
    await db
      .insert(categories)
      .values(cat)
      .onConflictDoNothing({ target: categories.slug });
  }
  logger.info({ count: defaultCategories.length }, "Categories seeded");

  // Seed crawl sources
  for (const source of defaultSources) {
    await sourceRepo.upsert({
      name: source.name,
      type: source.type,
      enabled: source.enabled,
      schedule: source.schedule,
      config: source.config,
    });
  }
  logger.info({ count: defaultSources.length }, "Crawl sources seeded");

  logger.info("Seeding complete");
  process.exit(0);
}

seed().catch((err) => {
  logger.fatal({ err }, "Seeding failed");
  process.exit(1);
});
