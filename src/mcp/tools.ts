import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serverRepo } from "../db/server-repo.js";
import { categoryRepo } from "../db/category-repo.js";

export function registerTools(server: McpServer): void {
  server.tool(
    "search_servers",
    "Search the MCP server index. Returns servers matching a query, optionally filtered by category and sorted by quality, stars, downloads, recency, or name.",
    {
      query: z.string().optional().describe("Search query to match against server names"),
      category: z.string().optional().describe("Category slug to filter by (e.g. 'developer-tools')"),
      sortBy: z.enum(["quality", "stars", "downloads", "recent", "name"]).optional().describe("Sort order"),
      limit: z.number().min(1).max(50).optional().describe("Max results (default 20)"),
    },
    async ({ query, category, sortBy, limit }) => {
      let categoryId: string | undefined;
      if (category) {
        const cat = await categoryRepo.findBySlug(category);
        categoryId = cat?.id;
      }

      const result = await serverRepo.list({
        search: query,
        categoryId,
        sortBy: sortBy ?? "quality",
        limit: limit ?? 20,
      });

      const text = result.items
        .map((s) => {
          const cat = s.category ? ` [${s.category.name}]` : "";
          return `- **${s.name}**${cat} (score: ${s.qualityScore}, stars: ${s.stars || 0}, downloads: ${s.weeklyDownloads || 0})\n  ${s.description || "No description"}\n  Slug: \`${s.slug}\``;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${result.total} servers${query ? ` matching "${query}"` : ""}:\n\n${text}`,
          },
        ],
      };
    },
  );

  server.tool(
    "get_server",
    "Get full details of a specific MCP server by its slug, including its tools, resources, and prompts.",
    {
      slug: z.string().describe("The server's unique slug identifier"),
    },
    async ({ slug }) => {
      const s = await serverRepo.findBySlug(slug);
      if (!s) {
        return {
          content: [{ type: "text" as const, text: `Server not found: ${slug}` }],
          isError: true,
        };
      }

      const lines = [
        `# ${s.name}`,
        s.description ? `\n${s.description}` : "",
        `\n**Quality Score**: ${s.qualityScore}/100`,
        `**Stars**: ${s.stars || 0} | **Weekly Downloads**: ${s.weeklyDownloads || 0}`,
        s.author ? `**Author**: ${s.author}` : "",
        s.license ? `**License**: ${s.license}` : "",
        s.version ? `**Version**: ${s.version}` : "",
        s.repositoryUrl ? `**Repository**: ${s.repositoryUrl}` : "",
        s.npmPackage ? `**NPM**: ${s.npmPackage}` : "",
        s.installCommand ? `**Install**: \`${s.installCommand}\`` : "",
        s.category ? `**Category**: ${s.category.name}` : "",
      ];

      if (s.tools.length > 0) {
        lines.push(`\n## Tools (${s.tools.length})`);
        for (const t of s.tools) {
          lines.push(`- **${t.name}**: ${t.description || "No description"}`);
        }
      }

      if (s.resources.length > 0) {
        lines.push(`\n## Resources (${s.resources.length})`);
        for (const r of s.resources) {
          lines.push(`- **${r.name || r.uri}**: ${r.description || "No description"}`);
        }
      }

      if (s.prompts.length > 0) {
        lines.push(`\n## Prompts (${s.prompts.length})`);
        for (const p of s.prompts) {
          lines.push(`- **${p.name}**: ${p.description || "No description"}`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
      };
    },
  );

  server.tool(
    "list_categories",
    "List all available MCP server categories with the count of servers in each.",
    {},
    async () => {
      const cats = await categoryRepo.listWithCounts();
      const text = cats
        .map((c) => `- **${c.name}** (\`${c.slug}\`): ${c.serverCount} servers — ${c.description || ""}`)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `## Categories\n\n${text}` }],
      };
    },
  );

  server.tool(
    "get_index_stats",
    "Get overall statistics about the MCP server index: total servers, top categories, and last crawl time.",
    {},
    async () => {
      const stats = await serverRepo.getStats();
      const topCats = stats.topCategories
        .map((c) => `  - ${c.name}: ${c.count} servers`)
        .join("\n");

      const text = [
        `## MCP Index Statistics`,
        `**Total Servers**: ${stats.totalServers}`,
        `**Last Crawled**: ${stats.lastCrawledAt || "Never"}`,
        `\n### Top Categories`,
        topCats,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
