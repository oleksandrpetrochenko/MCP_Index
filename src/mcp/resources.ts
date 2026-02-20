import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serverRepo } from "../db/server-repo.js";

export function registerResources(server: McpServer): void {
  server.resource(
    "index-stats",
    "mcp-index://stats",
    {
      description: "Live statistics about the MCP server index",
      mimeType: "application/json",
    },
    async () => {
      const stats = await serverRepo.getStats();
      return {
        contents: [
          {
            uri: "mcp-index://stats",
            mimeType: "application/json",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "popular-servers",
    "mcp-index://servers/popular",
    {
      description: "Top 20 MCP servers ranked by quality score",
      mimeType: "application/json",
    },
    async () => {
      const result = await serverRepo.list({ limit: 20, sortBy: "quality" });

      const simplified = result.items.map((s) => ({
        name: s.name,
        slug: s.slug,
        description: s.description,
        qualityScore: s.qualityScore,
        stars: s.stars,
        weeklyDownloads: s.weeklyDownloads,
        category: s.category?.name || null,
        author: s.author,
        repositoryUrl: s.repositoryUrl,
      }));

      return {
        contents: [
          {
            uri: "mcp-index://servers/popular",
            mimeType: "application/json",
            text: JSON.stringify(simplified, null, 2),
          },
        ],
      };
    },
  );
}
