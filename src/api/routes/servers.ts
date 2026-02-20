import type { FastifyInstance } from "fastify";
import { serverRepo } from "../../db/server-repo.js";

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  // List servers
  app.get<{
    Querystring: { limit?: string; offset?: string; search?: string };
  }>("/servers", async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || "50", 10), 100);
    const offset = parseInt(request.query.offset || "0", 10);
    const search = request.query.search;

    const result = await serverRepo.list({ limit, offset, search });

    return reply.send({
      data: result.items,
      total: result.total,
      limit,
      offset,
    });
  });

  // Get server by slug
  app.get<{ Params: { slug: string } }>("/servers/:slug", async (request, reply) => {
    const server = await serverRepo.findBySlug(request.params.slug);

    if (!server) {
      return reply.code(404).send({ error: "Server not found" });
    }

    return reply.send(server);
  });
}
