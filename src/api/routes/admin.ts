import type { FastifyInstance } from "fastify";
import { config } from "../../config/index.js";
import { runCrawlForSource, runAllCrawls } from "../../crawler/index.js";
import { jobRepo } from "../../db/source-repo.js";
import { getCrawlQueue } from "../../scheduler/index.js";
import { scoreAllServers } from "../../scoring/index.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Simple API key auth for admin routes
  app.addHook("onRequest", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (apiKey !== config.ADMIN_API_KEY) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // Trigger a crawl for a specific source
  app.post<{ Body: { source?: string } }>("/crawl", async (request, reply) => {
    const { source } = request.body || {};

    if (source) {
      try {
        const result = await runCrawlForSource(source);
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(400).send({ error: msg });
      }
    }

    // Run all crawls
    const results = await runAllCrawls();
    return reply.send({ results });
  });

  // Add a crawl job to the queue (async)
  app.post<{ Body: { source: string } }>("/crawl/queue", async (request, reply) => {
    const { source } = request.body;
    if (!source) {
      return reply.code(400).send({ error: "source is required" });
    }

    const queue = getCrawlQueue();
    const job = await queue.add(`crawl:${source}`, { sourceName: source });

    return reply.send({ queued: true, jobId: job.id });
  });

  // Trigger quality scoring
  app.post("/score", async (_request, reply) => {
    try {
      const results = await scoreAllServers();
      const top10 = results.sort((a, b) => b.score - a.score).slice(0, 10);
      return reply.send({
        scored: results.length,
        top10: top10.map((r) => ({
          serverId: r.serverId,
          score: Math.round(r.score),
          breakdown: r.breakdown,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });

  // Check crawl job status
  app.get<{ Params: { jobId: string } }>("/crawl/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const job = await jobRepo.findById(jobId);

    if (!job) {
      return reply.code(404).send({ error: "Job not found" });
    }

    return reply.send(job);
  });
}
