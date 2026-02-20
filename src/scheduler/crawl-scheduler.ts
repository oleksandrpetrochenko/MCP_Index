import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config/index.js";
import { createChildLogger } from "../utils/logger.js";
import { sourceRepo } from "../db/source-repo.js";
import { runCrawlForSource } from "../crawler/index.js";

const log = createChildLogger("crawl-scheduler");

let connection: IORedis | null = null;
let crawlQueue: Queue | null = null;
let crawlWorker: Worker | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getCrawlQueue(): Queue {
  if (!crawlQueue) {
    crawlQueue = new Queue("crawl", { connection: getConnection() });
  }
  return crawlQueue;
}

export async function scheduleCrawls(): Promise<void> {
  const queue = getCrawlQueue();
  const sources = await sourceRepo.findAll(true);

  // Remove existing repeatable jobs first
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  for (const source of sources) {
    if (source.schedule) {
      await queue.add(
        `crawl:${source.name}`,
        { sourceName: source.name },
        {
          repeat: { pattern: source.schedule },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      log.info({ source: source.name, schedule: source.schedule }, "Scheduled crawl");
    }
  }
}

export function startCrawlWorker(): Worker {
  const worker = new Worker(
    "crawl",
    async (job) => {
      const { sourceName } = job.data;
      log.info({ sourceName, jobId: job.id }, "Processing crawl job");

      try {
        const result = await runCrawlForSource(sourceName);
        return result;
      } catch (err) {
        log.error({ sourceName, err }, "Crawl job failed");
        throw err;
      }
    },
    {
      connection: getConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job?.id }, "Crawl job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Crawl job failed");
  });

  crawlWorker = worker;
  return worker;
}

export async function shutdown(): Promise<void> {
  if (crawlWorker) {
    await crawlWorker.close();
  }
  if (crawlQueue) {
    await crawlQueue.close();
  }
  if (connection) {
    connection.disconnect();
  }
}
