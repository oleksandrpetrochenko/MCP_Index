import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import ejs from "ejs";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { adminRoutes } from "./api/routes/admin.js";
import { serverRoutes } from "./api/routes/servers.js";
import { partnerRoutes } from "./api/routes/partners.js";
import { advertiserRoutes } from "./api/routes/advertisers.js";
import { mcpSseRoutes } from "./mcp/sse-transport.js";
import { webRoutes } from "./web/routes.js";
import { scheduleCrawls, startCrawlWorker, shutdown as shutdownScheduler } from "./scheduler/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const app = Fastify({ logger: false });

// Plugins
await app.register(cors, { origin: true });
await app.register(fastifyView, {
  engine: { ejs },
  root: join(rootDir, "views"),
  defaultContext: { title: "MCP Index" },
});
await app.register(fastifyStatic, {
  root: join(rootDir, "public"),
  prefix: "/public/",
});

// API Routes
await app.register(adminRoutes, { prefix: "/api/v1/admin" });
await app.register(serverRoutes, { prefix: "/api/v1" });
await app.register(partnerRoutes, { prefix: "/api/v1/partners" });
await app.register(advertiserRoutes, { prefix: "/api/v1/advertisers" });
await app.register(mcpSseRoutes, { prefix: "/mcp" });

// Web Routes
await app.register(webRoutes);

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info({ signal }, "Shutting down");
    await shutdownScheduler();
    await app.close();
    process.exit(0);
  });
}

// Start
try {
  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info({ port: config.PORT, host: config.HOST }, "Server started");

  // Start scheduler & worker
  startCrawlWorker();
  await scheduleCrawls();
  logger.info("Crawl scheduler and worker started");
} catch (err) {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
}
