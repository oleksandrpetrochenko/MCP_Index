import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://mcp:mcp_secret@localhost:5432/mcp_index"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GITHUB_TOKEN: z.string().default(""),
  NPM_TOKEN: z.string().default(""),
  ADMIN_API_KEY: z.string().default("change-me-in-production"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
