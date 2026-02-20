import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { crawlSources, crawlJobs } from "./schema.js";

export const sourceRepo = {
  async upsert(input: {
    name: string;
    type: string;
    enabled: boolean;
    schedule?: string | null;
    config?: Record<string, unknown>;
  }) {
    const [result] = await db
      .insert(crawlSources)
      .values(input)
      .onConflictDoUpdate({
        target: crawlSources.name,
        set: {
          type: input.type,
          enabled: input.enabled,
          schedule: input.schedule,
          config: input.config,
        },
      })
      .returning();
    return result;
  },

  async findAll(enabledOnly = false) {
    if (enabledOnly) {
      return db.select().from(crawlSources).where(eq(crawlSources.enabled, true));
    }
    return db.select().from(crawlSources);
  },

  async findByName(name: string) {
    const [result] = await db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.name, name))
      .limit(1);
    return result;
  },

  async markRun(id: string) {
    await db
      .update(crawlSources)
      .set({ lastRunAt: new Date() })
      .where(eq(crawlSources.id, id));
  },
};

export const jobRepo = {
  async create(sourceId?: string) {
    const [result] = await db
      .insert(crawlJobs)
      .values({
        sourceId,
        status: "pending",
      })
      .returning();
    return result;
  },

  async start(id: string) {
    await db
      .update(crawlJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(crawlJobs.id, id));
  },

  async complete(
    id: string,
    stats: { serversFound: number; serversAdded: number; serversUpdated: number },
  ) {
    await db
      .update(crawlJobs)
      .set({
        status: "completed",
        ...stats,
        completedAt: new Date(),
      })
      .where(eq(crawlJobs.id, id));
  },

  async fail(id: string, errors: string[]) {
    await db
      .update(crawlJobs)
      .set({
        status: "failed",
        errors,
        completedAt: new Date(),
      })
      .where(eq(crawlJobs.id, id));
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(crawlJobs)
      .where(eq(crawlJobs.id, id))
      .limit(1);
    return result;
  },
};
