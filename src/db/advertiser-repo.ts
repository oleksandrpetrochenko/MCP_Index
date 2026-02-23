import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { advertisers } from "./schema.js";
import crypto from "crypto";

export interface CreateAdvertiserInput {
  name: string;
  email: string;
  billingExternalId?: string;
  metadata?: Record<string, unknown>;
}

function generateApiKey(): string {
  return `adv_${crypto.randomBytes(24).toString("hex")}`;
}

export const advertiserRepo = {
  async create(input: CreateAdvertiserInput) {
    const [result] = await db
      .insert(advertisers)
      .values({ ...input, apiKey: generateApiKey() })
      .returning();
    return result;
  },

  async findByApiKey(apiKey: string) {
    const [result] = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.apiKey, apiKey))
      .limit(1);
    return result;
  },

  async findByEmail(email: string) {
    const [result] = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.email, email))
      .limit(1);
    return result;
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.id, id))
      .limit(1);
    return result;
  },

  async updateStatus(id: string, status: string) {
    await db
      .update(advertisers)
      .set({ status, updatedAt: new Date() })
      .where(eq(advertisers.id, id));
  },

  async listAll() {
    return db.select().from(advertisers).orderBy(advertisers.createdAt);
  },
};
