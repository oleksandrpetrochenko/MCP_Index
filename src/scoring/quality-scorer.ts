import { createChildLogger } from "../utils/logger.js";
import { serverRepo } from "../db/server-repo.js";

const log = createChildLogger("quality-scorer");

const WEIGHTS = {
  popularity: 0.30,
  freshness: 0.20,
  completeness: 0.20,
  mcpCompliance: 0.20,
  community: 0.10,
};

function logNormalize(value: number, referenceMax: number): number {
  if (value <= 0) return 0;
  if (referenceMax <= 0) return 0;
  const normalized = (Math.log1p(value) / Math.log1p(referenceMax)) * 100;
  return Math.min(100, normalized);
}

function daysSince(date: Date | string | null): number {
  if (!date) return 999;
  const d = typeof date === "string" ? new Date(date) : date;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

interface ServerData {
  id: string;
  stars: number | null;
  weeklyDownloads: number | null;
  description: string | null;
  license: string | null;
  installCommand: string | null;
  updatedAt: Date;
  lastCrawledAt: Date | null;
  metadata: Record<string, unknown> | null;
  tools: unknown[];
  resources: unknown[];
  prompts: unknown[];
}

function scorePopularity(server: ServerData, maxStars: number, maxDownloads: number): number {
  const starScore = logNormalize(server.stars || 0, maxStars);
  const downloadScore = logNormalize(server.weeklyDownloads || 0, maxDownloads);
  return starScore * 0.6 + downloadScore * 0.4;
}

function scoreFreshness(server: ServerData): number {
  const meta = server.metadata as Record<string, unknown> | null;
  const pushedAt = meta?.pushedAt as string | undefined;
  const lastActivity = pushedAt || server.updatedAt?.toISOString();
  const days = daysSince(lastActivity);

  if (days <= 7) return 100;
  if (days <= 30) return 80;
  if (days <= 90) return 60;
  if (days <= 180) return 40;
  if (days <= 365) return 20;
  return 5;
}

function scoreCompleteness(server: ServerData): number {
  let score = 0;
  if (server.description && server.description.length > 10) score += 25;
  if (server.license) score += 20;
  if (server.installCommand) score += 30;
  const meta = server.metadata as Record<string, unknown> | null;
  if (meta?.readme || server.description) score += 25;
  return score;
}

function scoreMcpCompliance(server: ServerData): number {
  let score = 0;
  if (server.tools.length > 0) score += 35;
  if (server.resources.length > 0) score += 20;
  if (server.prompts.length > 0) score += 15;
  const meta = server.metadata as Record<string, unknown> | null;
  if (meta?.hasMcpDependency) score += 30;
  return score;
}

function scoreCommunity(server: ServerData): number {
  const meta = server.metadata as Record<string, unknown> | null;
  const forks = (meta?.forksCount as number) || 0;
  const issues = (meta?.openIssuesCount as number) || 0;
  const forkScore = Math.min(100, forks * 5);
  const activityScore = Math.min(100, issues * 3);
  return forkScore * 0.6 + activityScore * 0.4;
}

export interface ScoringResult {
  serverId: string;
  score: number;
  breakdown: {
    popularity: number;
    freshness: number;
    completeness: number;
    mcpCompliance: number;
    community: number;
  };
}

export async function scoreAllServers(): Promise<ScoringResult[]> {
  log.info("Starting quality scoring for all servers");

  const allServers = await serverRepo.listAll();
  if (allServers.length === 0) {
    log.info("No servers to score");
    return [];
  }

  const sortedStars = allServers.map((s) => s.stars || 0).sort((a, b) => b - a);
  const sortedDownloads = allServers.map((s) => s.weeklyDownloads || 0).sort((a, b) => b - a);
  const p95Index = Math.floor(allServers.length * 0.05);
  const maxStars = sortedStars[p95Index] || sortedStars[0] || 1;
  const maxDownloads = sortedDownloads[p95Index] || sortedDownloads[0] || 1;

  const results: ScoringResult[] = [];

  for (const server of allServers) {
    const s = server as unknown as ServerData;
    const breakdown = {
      popularity: scorePopularity(s, maxStars, maxDownloads),
      freshness: scoreFreshness(s),
      completeness: scoreCompleteness(s),
      mcpCompliance: scoreMcpCompliance(s),
      community: scoreCommunity(s),
    };

    const score =
      breakdown.popularity * WEIGHTS.popularity +
      breakdown.freshness * WEIGHTS.freshness +
      breakdown.completeness * WEIGHTS.completeness +
      breakdown.mcpCompliance * WEIGHTS.mcpCompliance +
      breakdown.community * WEIGHTS.community;

    results.push({ serverId: server.id, score, breakdown });
    await serverRepo.updateQualityScore(server.id, score);
  }

  log.info({ serverCount: results.length }, "Quality scoring complete");
  return results;
}
