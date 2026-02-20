import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { adminRoutes } from "./api/routes/admin.js";
import { serverRoutes } from "./api/routes/servers.js";
import { mcpSseRoutes } from "./mcp/sse-transport.js";
import { scheduleCrawls, startCrawlWorker, shutdown as shutdownScheduler } from "./scheduler/index.js";

const app = Fastify({ logger: false });

// Plugins
await app.register(cors, { origin: true });

// Routes
await app.register(adminRoutes, { prefix: "/api/v1/admin" });
await app.register(serverRoutes, { prefix: "/api/v1" });
await app.register(mcpSseRoutes, { prefix: "/mcp" });

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
