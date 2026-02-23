import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Categories ──────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  parentId: uuid("parent_id").references((): any => categories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  servers: many(mcpServers),
}));

// ── MCP Servers ─────────────────────────────────────────────────────
export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    repositoryUrl: text("repository_url"),
    npmPackage: varchar("npm_package", { length: 255 }),
    homepage: text("homepage"),
    author: varchar("author", { length: 255 }),
    license: varchar("license", { length: 50 }),
    version: varchar("version", { length: 50 }),
    installCommand: text("install_command"),
    categoryId: uuid("category_id").references(() => categories.id),
    stars: integer("stars").default(0),
    weeklyDownloads: integer("weekly_downloads").default(0),
    isOfficial: boolean("is_official").default(false),
    isVerified: boolean("is_verified").default(false),
    qualityScore: integer("quality_score").default(0), // placeholder 0-100
    lastCrawledAt: timestamp("last_crawled_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("mcp_servers_slug_idx").on(table.slug),
    index("mcp_servers_category_idx").on(table.categoryId),
    index("mcp_servers_stars_idx").on(table.stars),
    index("mcp_servers_quality_idx").on(table.qualityScore),
  ],
);

export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  category: one(categories, {
    fields: [mcpServers.categoryId],
    references: [categories.id],
  }),
  tools: many(mcpTools),
  resources: many(mcpResources),
  prompts: many(mcpPrompts),
}));

// ── MCP Tools ───────────────────────────────────────────────────────
export const mcpTools = pgTable(
  "mcp_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    inputSchema: jsonb("input_schema"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("mcp_tools_server_idx").on(table.serverId)],
);

export const mcpToolsRelations = relations(mcpTools, ({ one }) => ({
  server: one(mcpServers, {
    fields: [mcpTools.serverId],
    references: [mcpServers.id],
  }),
}));

// ── MCP Resources ───────────────────────────────────────────────────
export const mcpResources = pgTable(
  "mcp_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    uri: text("uri").notNull(),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    mimeType: varchar("mime_type", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("mcp_resources_server_idx").on(table.serverId)],
);

export const mcpResourcesRelations = relations(mcpResources, ({ one }) => ({
  server: one(mcpServers, {
    fields: [mcpResources.serverId],
    references: [mcpServers.id],
  }),
}));

// ── MCP Prompts ─────────────────────────────────────────────────────
export const mcpPrompts = pgTable(
  "mcp_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    arguments: jsonb("arguments"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("mcp_prompts_server_idx").on(table.serverId)],
);

export const mcpPromptsRelations = relations(mcpPrompts, ({ one }) => ({
  server: one(mcpServers, {
    fields: [mcpPrompts.serverId],
    references: [mcpServers.id],
  }),
}));

// ── Crawl Sources ───────────────────────────────────────────────────
export const crawlSources = pgTable("crawl_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  schedule: varchar("schedule", { length: 100 }),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Crawl Jobs ──────────────────────────────────────────────────────
export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => crawlSources.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    serversFound: integer("servers_found").default(0),
    serversAdded: integer("servers_added").default(0),
    serversUpdated: integer("servers_updated").default(0),
    errors: jsonb("errors").$type<string[]>().default([]),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("crawl_jobs_source_idx").on(table.sourceId),
    index("crawl_jobs_status_idx").on(table.status),
  ],
);

export const crawlJobsRelations = relations(crawlJobs, ({ one }) => ({
  source: one(crawlSources, {
    fields: [crawlJobs.sourceId],
    references: [crawlSources.id],
  }),
}));

// ── Advertisers ────────────────────────────────────────────────────
export const advertisers = pgTable(
  "advertisers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    apiKey: varchar("api_key", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // active | suspended | pending
    billingExternalId: varchar("billing_external_id", { length: 255 }), // LemonSqueezy customer ID
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("advertisers_email_idx").on(table.email),
    uniqueIndex("advertisers_api_key_idx").on(table.apiKey),
  ],
);

export const advertisersRelations = relations(advertisers, ({ many }) => ({
  promotions: many(promotions),
}));

// ── Promotions ─────────────────────────────────────────────────────
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id),
    serverId: uuid("server_id")
      .notNull()
      .references(() => mcpServers.id),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | paused | exhausted | expired
    dailyBudgetCents: integer("daily_budget_cents").notNull().default(500), // $5/day default
    totalBudgetCents: integer("total_budget_cents").notNull().default(15000), // $150 default
    spentCents: integer("spent_cents").notNull().default(0),
    costPerImpressionCents: integer("cost_per_impression_cents").notNull().default(1), // $0.01
    costPerClickCents: integer("cost_per_click_cents").notNull().default(10), // $0.10
    targetCategories: jsonb("target_categories").$type<string[]>(), // category slugs
    targetKeywords: jsonb("target_keywords").$type<string[]>(), // keyword matches
    priority: integer("priority").notNull().default(0), // higher = shown first
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("promotions_advertiser_idx").on(table.advertiserId),
    index("promotions_server_idx").on(table.serverId),
    index("promotions_status_idx").on(table.status),
  ],
);

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  advertiser: one(advertisers, {
    fields: [promotions.advertiserId],
    references: [advertisers.id],
  }),
  server: one(mcpServers, {
    fields: [promotions.serverId],
    references: [mcpServers.id],
  }),
  impressions: many(adImpressions),
  clicks: many(adClicks),
  ledgerEntries: many(revenueLedger),
}));

// ── Partner Platforms ──────────────────────────────────────────────
export const partnerPlatforms = pgTable(
  "partner_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    apiKey: varchar("api_key", { length: 64 }).notNull(),
    revenueSharePercent: integer("revenue_share_percent").notNull().default(20),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | active | suspended
    tier: varchar("tier", { length: 20 }).notNull().default("free"), // free | basic | premium
    includePromoted: boolean("include_promoted").default(false).notNull(),
    callbackUrl: text("callback_url"),
    billingExternalId: varchar("billing_external_id", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_platforms_api_key_idx").on(table.apiKey),
    index("partner_platforms_status_idx").on(table.status),
  ],
);

export const partnerPlatformsRelations = relations(partnerPlatforms, ({ many }) => ({
  impressions: many(adImpressions),
  clicks: many(adClicks),
  ledgerEntries: many(revenueLedger),
}));

// ── Ad Impressions ─────────────────────────────────────────────────
export const adImpressions = pgTable(
  "ad_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id),
    partnerPlatformId: uuid("partner_platform_id").references(() => partnerPlatforms.id),
    sessionId: varchar("session_id", { length: 255 }),
    searchQuery: text("search_query"),
    position: integer("position").notNull().default(0), // 0-indexed position in results
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ad_impressions_promotion_idx").on(table.promotionId),
    index("ad_impressions_partner_idx").on(table.partnerPlatformId),
    index("ad_impressions_created_idx").on(table.createdAt),
  ],
);

export const adImpressionsRelations = relations(adImpressions, ({ one }) => ({
  promotion: one(promotions, {
    fields: [adImpressions.promotionId],
    references: [promotions.id],
  }),
  partnerPlatform: one(partnerPlatforms, {
    fields: [adImpressions.partnerPlatformId],
    references: [partnerPlatforms.id],
  }),
}));

// ── Ad Clicks ──────────────────────────────────────────────────────
export const adClicks = pgTable(
  "ad_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    impressionId: uuid("impression_id").references(() => adImpressions.id),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id),
    partnerPlatformId: uuid("partner_platform_id").references(() => partnerPlatforms.id),
    serverSlug: varchar("server_slug", { length: 255 }).notNull(),
    clickType: varchar("click_type", { length: 20 }).notNull().default("detail"), // detail | install | link | callback
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ad_clicks_promotion_idx").on(table.promotionId),
    index("ad_clicks_partner_idx").on(table.partnerPlatformId),
    index("ad_clicks_created_idx").on(table.createdAt),
  ],
);

export const adClicksRelations = relations(adClicks, ({ one }) => ({
  impression: one(adImpressions, {
    fields: [adClicks.impressionId],
    references: [adImpressions.id],
  }),
  promotion: one(promotions, {
    fields: [adClicks.promotionId],
    references: [promotions.id],
  }),
  partnerPlatform: one(partnerPlatforms, {
    fields: [adClicks.partnerPlatformId],
    references: [partnerPlatforms.id],
  }),
}));

// ── Revenue Ledger ─────────────────────────────────────────────────
export const revenueLedger = pgTable(
  "revenue_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id),
    partnerPlatformId: uuid("partner_platform_id").references(() => partnerPlatforms.id),
    eventType: varchar("event_type", { length: 20 }).notNull(), // impression | click | payout | refund
    grossAmountCents: integer("gross_amount_cents").notNull(),
    partnerShareCents: integer("partner_share_cents").notNull().default(0),
    netAmountCents: integer("net_amount_cents").notNull(),
    referenceId: uuid("reference_id"), // points to impression or click ID
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("revenue_ledger_promotion_idx").on(table.promotionId),
    index("revenue_ledger_partner_idx").on(table.partnerPlatformId),
    index("revenue_ledger_created_idx").on(table.createdAt),
  ],
);

export const revenueLedgerRelations = relations(revenueLedger, ({ one }) => ({
  promotion: one(promotions, {
    fields: [revenueLedger.promotionId],
    references: [promotions.id],
  }),
  partnerPlatform: one(partnerPlatforms, {
    fields: [revenueLedger.partnerPlatformId],
    references: [partnerPlatforms.id],
  }),
}));
