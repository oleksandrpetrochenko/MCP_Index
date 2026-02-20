import "dotenv/config";
import { runCrawlForSource, runAllCrawls } from "../src/crawler/index.js";
import { logger } from "../src/utils/logger.js";

const sourceName = process.argv[2];

async function main() {
  if (sourceName) {
    logger.info({ source: sourceName }, "Running single crawl");
    const result = await runCrawlForSource(sourceName);
    logger.info({ result }, "Crawl complete");
  } else {
    logger.info("Running all crawls");
    const results = await runAllCrawls();
    logger.info({ results }, "All crawls complete");
  }
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "Crawl script failed");
  process.exit(1);
});
