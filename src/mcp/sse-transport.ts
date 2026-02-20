import type { FastifyInstance } from "fastify";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("mcp-sse");

export async function mcpSseRoutes(app: FastifyInstance): Promise<void> {
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (request, reply) => {
    log.info("New SSE connection");

    reply.hijack();

    const transport = new SSEServerTransport("/mcp/messages", reply.raw);
    const mcpServer = createMcpServer();

    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    request.raw.on("close", () => {
      log.info({ sessionId }, "SSE connection closed");
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  });

  app.post<{ Querystring: { sessionId: string } }>("/messages", async (request, reply) => {
    const { sessionId } = request.query;
    const transport = transports.get(sessionId);

    if (!transport) {
      return reply.code(404).send({ error: "Session not found" });
    }

    await transport.handlePostMessage(request.raw, reply.raw);
  });
}
