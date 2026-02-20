import { eq, ilike, desc, sql, and } from "drizzle-orm";
import { db } from "../config/database.js";
import { mcpServers, mcpTools, mcpResources, mcpPrompts, categories } from "./schema.js";

export interface UpsertServerInput {
  name: string;
  slug: string;
  description?: string | null;
  repositoryUrl?: string | null;
  npmPackage?: string | null;
  homepage?: string | null;
  author?: string | null;
  license?: string | null;
  version?: string | null;
  installCommand?: string | null;
  categoryId?: string | null;
  stars?: number;
  weeklyDownloads?: number;
  isOfficial?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolInput {
  name: string;
  description?: string | null;
  inputSchema?: unknown;
}

export interface ResourceInput {
  uri: string;
  name?: string | null;
  description?: string | null;
  mimeType?: string | null;
}

export interface PromptInput {
  name: string;
  description?: string | null;
  arguments?: unknown;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const serverRepo = {
  async upsert(input: UpsertServerInput) {
    const slug = input.slug || slugify(input.name);
    const now = new Date();

    const [result] = await db
      .insert(mcpServers)
      .values({
        ...input,
        slug,
        updatedAt: now,
        lastCrawledAt: now,
      })
      .onConflictDoUpdate({
        target: mcpServers.slug,
        set: {
          name: input.name,
          description: input.description,
          repositoryUrl: input.repositoryUrl,
          npmPackage: input.npmPackage,
          homepage: input.homepage,
          author: input.author,
          license: input.license,
          version: input.version,
          installCommand: input.installCommand,
          stars: input.stars,
          weeklyDownloads: input.weeklyDownloads,
          isOfficial: input.isOfficial,
          metadata: input.metadata,
          lastCrawledAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  },

  async setTools(serverId: string, tools: ToolInput[]) {
    await db.delete(mcpTools).where(eq(mcpTools.serverId, serverId));
    if (tools.length === 0) return;
    await db.insert(mcpTools).values(
      tools.map((t) => ({ ...t, serverId })),
    );
  },

  async setResources(serverId: string, resources: ResourceInput[]) {
    await db.delete(mcpResources).where(eq(mcpResources.serverId, serverId));
    if (resources.length === 0) return;
    await db.insert(mcpResources).values(
      resources.map((r) => ({ ...r, serverId })),
    );
  },

  async setPrompts(serverId: string, prompts: PromptInput[]) {
    await db.delete(mcpPrompts).where(eq(mcpPrompts.serverId, serverId));
    if (prompts.length === 0) return;
    await db.insert(mcpPrompts).values(
      prompts.map((p) => ({ ...p, serverId })),
    );
  },

  async findBySlug(slug: string) {
    return db.query.mcpServers.findFirst({
      where: eq(mcpServers.slug, slug),
      with: { tools: true, resources: true, prompts: true, category: true },
    });
  },

  async list(options: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: "quality" | "stars" | "downloads" | "recent" | "name";
    categoryId?: string;
  } = {}) {
    const { limit = 50, offset = 0, search, sortBy = "quality", categoryId } = options;

    const conditions = [];
    if (search) conditions.push(ilike(mcpServers.name, `%${search}%`));
    if (categoryId) conditions.push(eq(mcpServers.categoryId, categoryId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByMap = {
      quality: [desc(mcpServers.qualityScore), desc(mcpServers.stars)],
      stars: [desc(mcpServers.stars)],
      downloads: [desc(mcpServers.weeklyDownloads)],
      recent: [desc(mcpServers.updatedAt)],
      name: [mcpServers.name],
    } as const;
    const orderBy = orderByMap[sortBy] || orderByMap.quality;

    const items = await db.query.mcpServers.findMany({
      where,
      with: { category: true },
      orderBy: [...orderBy],
      limit,
      offset,
    });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcpServers)
      .where(where);

    return { items, total: Number(count) };
  },

  async existsBySlug(slug: string): Promise<boolean> {
    const result = await db
      .select({ id: mcpServers.id })
      .from(mcpServers)
      .where(eq(mcpServers.slug, slug))
      .limit(1);
    return result.length > 0;
  },

  async updateQualityScore(serverId: string, score: number) {
    await db
      .update(mcpServers)
      .set({
        qualityScore: Math.max(0, Math.min(100, Math.round(score))),
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, serverId));
  },

  async listAll() {
    return db.query.mcpServers.findMany({
      with: { tools: true, resources: true, prompts: true, category: true },
    });
  },

  async getStats() {
    const [serverCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcpServers);

    const [lastCrawled] = await db
      .select({ lastCrawledAt: sql<string>`max(${mcpServers.lastCrawledAt})` })
      .from(mcpServers);

    const topCategories = await db
      .select({
        name: categories.name,
        slug: categories.slug,
        count: sql<number>`count(${mcpServers.id})`,
      })
      .from(categories)
      .leftJoin(mcpServers, eq(categories.id, mcpServers.categoryId))
      .groupBy(categories.id, categories.name, categories.slug)
      .orderBy(sql`count(${mcpServers.id}) desc`)
      .limit(5);

    return {
      totalServers: Number(serverCount.count),
      lastCrawledAt: lastCrawled.lastCrawledAt,
      topCategories,
    };
  },
};
