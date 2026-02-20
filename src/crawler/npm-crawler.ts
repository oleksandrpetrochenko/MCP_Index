import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { fetchJson } from "../utils/http-client.js";
import { npmLimiter } from "../utils/rate-limiter.js";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      links: {
        npm?: string;
        homepage?: string;
        repository?: string;
      };
      author?: { name?: string; username?: string };
      publisher?: { username?: string };
      maintainers?: Array<{ username: string }>;
    };
    score: {
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
  }>;
  total: number;
}

interface NpmDownloadsResult {
  downloads: number;
}

interface NpmCrawlerConfig {
  searchTerms: string[];
}

const MCP_INDICATORS = [
  "mcp",
  "model-context-protocol",
  "model context protocol",
  "modelcontextprotocol",
  "mcp-server",
  "mcp-tool",
  "mcp-resource",
];

function isMcpPackage(pkg: {
  name: string;
  description?: string;
  keywords?: string[];
}): boolean {
  const name = pkg.name.toLowerCase();
  const desc = (pkg.description || "").toLowerCase();
  const keywords = (pkg.keywords || []).map((k) => k.toLowerCase());

  // Check name
  if (MCP_INDICATORS.some((ind) => name.includes(ind))) return true;

  // Check keywords
  if (keywords.some((kw) => MCP_INDICATORS.some((ind) => kw.includes(ind)))) return true;

  // Check description — must mention MCP in a meaningful way
  if (
    desc.includes("model context protocol") ||
    desc.includes("mcp server") ||
    desc.includes("mcp tool") ||
    desc.includes("mcp client") ||
    desc.includes("mcp resource") ||
    desc.includes("mcp prompt") ||
    /\bmcp\b/.test(desc)
  ) {
    return true;
  }

  return false;
}

export class NpmCrawler extends BaseCrawler {
  private crawlerConfig: NpmCrawlerConfig;

  constructor(crawlerConfig: NpmCrawlerConfig) {
    super("npm");
    this.crawlerConfig = crawlerConfig;
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    const seen = new Set<string>();
    let skipped = 0;

    for (const term of this.crawlerConfig.searchTerms) {
      this.log.info({ term }, "Searching NPM");

      let from = 0;
      const size = 250;
      let hasMore = true;

      while (hasMore) {
        try {
          const result = await fetchJson<NpmSearchResult>(
            `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(term)}&size=${size}&from=${from}`,
            { rateLimiter: npmLimiter },
          );

          if (result.objects.length === 0) {
            hasMore = false;
            break;
          }

          for (const obj of result.objects) {
            const pkg = obj.package;
            if (seen.has(pkg.name)) continue;
            seen.add(pkg.name);

            // Filter: only accept packages that are actually MCP-related
            if (!isMcpPackage(pkg)) {
              skipped++;
              continue;
            }

            let weeklyDownloads = 0;
            try {
              const dlResult = await fetchJson<NpmDownloadsResult>(
                `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg.name)}`,
                { rateLimiter: npmLimiter },
              );
              weeklyDownloads = dlResult.downloads;
            } catch {
              // downloads API can fail for scoped packages
            }

            const slug = slugify(pkg.name);
            const author = pkg.author?.name || pkg.publisher?.username || null;

            yield {
              server: {
                name: pkg.name,
                slug,
                description: pkg.description || null,
                repositoryUrl: pkg.links.repository || null,
                npmPackage: pkg.name,
                homepage: pkg.links.homepage || null,
                author,
                version: pkg.version,
                installCommand: `npx ${pkg.name}`,
                weeklyDownloads,
                metadata: {
                  source: "npm",
                  keywords: pkg.keywords,
                  npmUrl: pkg.links.npm,
                  score: obj.score.detail,
                },
              },
            };
          }

          from += size;
          if (from >= result.total) {
            hasMore = false;
          }
        } catch (err) {
          this.log.error({ term, from, err }, "NPM search failed");
          hasMore = false;
        }
      }
    }

    this.log.info({ skipped }, "Skipped non-MCP packages");
  }
}
