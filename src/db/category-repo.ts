import { eq, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { categories, mcpServers } from "./schema.js";

export const categoryRepo = {
  async findAll() {
    return db.select().from(categories).orderBy(categories.name);
  },

  async findBySlug(slug: string) {
    const [result] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);
    return result;
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return result;
  },

  async listWithCounts() {
    const results = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        serverCount: sql<number>`count(${mcpServers.id})`.as("server_count"),
      })
      .from(categories)
      .leftJoin(mcpServers, eq(categories.id, mcpServers.categoryId))
      .groupBy(categories.id, categories.name, categories.slug, categories.description)
      .orderBy(sql`count(${mcpServers.id}) desc`);
    return results;
  },
};
