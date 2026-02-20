import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { fetchJson } from "../utils/http-client.js";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface RegistryEntry {
  name: string;
  description?: string;
  repository?: string;
  npm?: string;
  homepage?: string;
  author?: string;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  resources?: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>;
  prompts?: Array<{ name: string; description?: string; arguments?: unknown }>;
}

interface RegistryCrawlerConfig {
  registryUrl: string;
}

export class RegistryCrawler extends BaseCrawler {
  private crawlerConfig: RegistryCrawlerConfig;

  constructor(crawlerConfig: RegistryCrawlerConfig) {
    super("registry");
    this.crawlerConfig = crawlerConfig;
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    this.log.info({ url: this.crawlerConfig.registryUrl }, "Fetching MCP registry");

    try {
      const entries = await fetchJson<RegistryEntry[]>(this.crawlerConfig.registryUrl);

      for (const entry of entries) {
        const slug = slugify(entry.name);

        yield {
          server: {
            name: entry.name,
            slug,
            description: entry.description || null,
            repositoryUrl: entry.repository || null,
            npmPackage: entry.npm || null,
            homepage: entry.homepage || null,
            author: entry.author || null,
            isOfficial: true,
            metadata: { source: "registry" },
          },
          tools: entry.tools?.map((t) => ({
            name: t.name,
            description: t.description || null,
            inputSchema: t.inputSchema,
          })),
          resources: entry.resources?.map((r) => ({
            uri: r.uri,
            name: r.name || null,
            description: r.description || null,
            mimeType: r.mimeType || null,
          })),
          prompts: entry.prompts?.map((p) => ({
            name: p.name,
            description: p.description || null,
            arguments: p.arguments,
          })),
        };
      }
    } catch (err) {
      this.log.error({ err }, "Registry crawl failed");
    }
  }
}
