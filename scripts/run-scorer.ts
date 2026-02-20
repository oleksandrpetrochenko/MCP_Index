import "dotenv/config";
import { scoreAllServers } from "../src/scoring/index.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  logger.info("Running quality scoring for all servers");
  const results = await scoreAllServers();
  logger.info({ scored: results.length }, "Scoring complete");

  const top10 = results.sort((a, b) => b.score - a.score).slice(0, 10);
  for (const r of top10) {
    logger.info({
      serverId: r.serverId,
      score: Math.round(r.score),
      breakdown: r.breakdown,
    });
  }

  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "Scoring script failed");
  process.exit(1);
});
