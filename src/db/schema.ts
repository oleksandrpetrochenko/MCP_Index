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
