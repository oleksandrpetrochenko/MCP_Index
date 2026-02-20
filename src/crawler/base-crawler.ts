import { createChildLogger } from "../utils/logger.js";
import { serverRepo, type UpsertServerInput, type ToolInput, type ResourceInput, type PromptInput } from "../db/server-repo.js";

export interface CrawlResult {
  server: UpsertServerInput;
  tools?: ToolInput[];
  resources?: ResourceInput[];
  prompts?: PromptInput[];
}

export interface CrawlStats {
  found: number;
  added: number;
  updated: number;
  errors: string[];
}

export abstract class BaseCrawler {
  protected log;

  constructor(public readonly name: string) {
    this.log = createChildLogger(`crawler:${name}`);
  }

  abstract crawl(): AsyncGenerator<CrawlResult>;

  async run(): Promise<CrawlStats> {
    const stats: CrawlStats = { found: 0, added: 0, updated: 0, errors: [] };

    this.log.info("Starting crawl");

    try {
      for await (const result of this.crawl()) {
        stats.found++;
        try {
          const existed = await serverRepo.existsBySlug(result.server.slug);
          const server = await serverRepo.upsert(result.server);

          if (existed) {
            stats.updated++;
          } else {
            stats.added++;
          }

          if (result.tools?.length) {
            await serverRepo.setTools(server.id, result.tools);
          }
          if (result.resources?.length) {
            await serverRepo.setResources(server.id, result.resources);
          }
          if (result.prompts?.length) {
            await serverRepo.setPrompts(server.id, result.prompts);
          }

          this.log.debug({ slug: result.server.slug }, "Processed server");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.errors.push(`${result.server.slug}: ${msg}`);
          this.log.error({ slug: result.server.slug, err }, "Failed to process server");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`Crawl error: ${msg}`);
      this.log.error({ err }, "Crawl failed");
    }

    this.log.info(stats, "Crawl complete");
    return stats;
  }
}
