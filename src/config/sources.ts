export interface CrawlSourceConfig {
  name: string;
  type: "github" | "npm" | "awesome-list" | "registry" | "custom-url";
  enabled: boolean;
  schedule: string; // cron expression
  config: Record<string, unknown>;
}

export const defaultSources: CrawlSourceConfig[] = [
  {
    name: "github-mcp-topic",
    type: "github",
    enabled: true,
    schedule: "0 */6 * * *", // every 6 hours
    config: {
      searchQueries: [
        "topic:mcp-server",
        "topic:model-context-protocol",
        "mcp server in:name,description",
      ],
      minStars: 1,
    },
  },
  {
    name: "npm-mcp-packages",
    type: "npm",
    enabled: true,
    schedule: "0 */6 * * *",
    config: {
      searchTerms: [
        "mcp-server",
        "model-context-protocol",
        "@modelcontextprotocol",
      ],
    },
  },
  {
    name: "awesome-mcp-servers",
    type: "awesome-list",
    enabled: true,
    schedule: "0 0 * * *", // daily
    config: {
      urls: [
        "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md",
        "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md",
      ],
    },
  },
];
