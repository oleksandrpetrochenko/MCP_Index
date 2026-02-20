import { createChildLogger } from "../utils/logger.js";
import { scoreAllServers } from "../scoring/index.js";
import { jobRepo, sourceRepo } from "../db/source-repo.js";
import { BaseCrawler, type CrawlStats } from "./base-crawler.js";
import { GitHubCrawler } from "./github-crawler.js";
import { NpmCrawler } from "./npm-crawler.js";
import { AwesomeListCrawler } from "./awesome-list-crawler.js";
import { RegistryCrawler } from "./registry-crawler.js";
import { CustomUrlCrawler } from "./custom-url-crawler.js";

const log = createChildLogger("crawler-orchestrator");

function createCrawler(type: string, config: Record<string, unknown>): BaseCrawler | null {
  switch (type) {
    case "github":
      return new GitHubCrawler(config as any);
    case "npm":
      return new NpmCrawler(config as any);
    case "awesome-list":
      return new AwesomeListCrawler(config as any);
    case "registry":
      return new RegistryCrawler(config as any);
    case "custom-url":
      return new CustomUrlCrawler(config as any);
    default:
      log.warn({ type }, "Unknown crawler type");
      return null;
  }
}

export async function runCrawlForSource(sourceName: string): Promise<{
  jobId: string;
  stats: CrawlStats;
}> {
  const source = await sourceRepo.findByName(sourceName);
  if (!source) {
    throw new Error(`Source not found: ${sourceName}`);
  }

  const job = await jobRepo.create(source.id);
  await jobRepo.start(job.id);

  log.info({ source: sourceName, jobId: job.id }, "Starting crawl for source");

  try {
    const crawler = createCrawler(source.type, (source.config as Record<string, unknown>) || {});
    if (!crawler) {
      throw new Error(`Cannot create crawler for type: ${source.type}`);
    }

    const stats = await crawler.run();

    await jobRepo.complete(job.id, {
      serversFound: stats.found,
      serversAdded: stats.added,
      serversUpdated: stats.updated,
    });

    await sourceRepo.markRun(source.id);

    try {
      await scoreAllServers();
      log.info("Quality scores updated after crawl");
    } catch (scoreErr) {
      log.error({ scoreErr }, "Quality scoring failed after crawl (non-fatal)");
    }

    log.info({ source: sourceName, jobId: job.id, stats }, "Crawl completed");
    return { jobId: job.id, stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await jobRepo.fail(job.id, [msg]);
    log.error({ source: sourceName, jobId: job.id, err }, "Crawl failed");
    throw err;
  }
}

export async function runAllCrawls(): Promise<
  Array<{ source: string; jobId: string; stats: CrawlStats }>
> {
  const sources = await sourceRepo.findAll(true);
  const results: Array<{ source: string; jobId: string; stats: CrawlStats }> = [];

  for (const source of sources) {
    try {
      const result = await runCrawlForSource(source.name);
      results.push({ source: source.name, ...result });
    } catch (err) {
      log.error({ source: source.name, err }, "Failed to run crawl");
    }
  }

  return results;
}

export {
  BaseCrawler,
  GitHubCrawler,
  NpmCrawler,
  AwesomeListCrawler,
  RegistryCrawler,
  CustomUrlCrawler,
};
