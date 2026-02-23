import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { partnerPlatforms } from "./schema.js";
import crypto from "crypto";

export interface CreatePartnerInput {
  name: string;
  contactEmail: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

function generateApiKey(): string {
  return `ptr_${crypto.randomBytes(24).toString("hex")}`;
}

export const partnerRepo = {
  async create(input: CreatePartnerInput) {
    const [result] = await db
      .insert(partnerPlatforms)
      .values({ ...input, apiKey: generateApiKey() })
      .returning();
    return result;
  },

  async findByApiKey(apiKey: string) {
    const [result] = await db
      .select()
      .from(partnerPlatforms)
      .where(eq(partnerPlatforms.apiKey, apiKey))
      .limit(1);
    return result;
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(partnerPlatforms)
      .where(eq(partnerPlatforms.id, id))
      .limit(1);
    return result;
  },

  async updateStatus(id: string, status: string) {
    await db
      .update(partnerPlatforms)
      .set({ status, updatedAt: new Date() })
      .where(eq(partnerPlatforms.id, id));
  },

  async setIncludePromoted(id: string, includePromoted: boolean) {
    await db
      .update(partnerPlatforms)
      .set({ includePromoted, updatedAt: new Date() })
      .where(eq(partnerPlatforms.id, id));
  },

  async listAll() {
    return db.select().from(partnerPlatforms).orderBy(partnerPlatforms.createdAt);
  },
};
