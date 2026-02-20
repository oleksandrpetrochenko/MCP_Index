import { Octokit } from "octokit";
import { config } from "../config/index.js";
import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { githubLimiter } from "../utils/rate-limiter.js";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface GitHubCrawlerConfig {
  searchQueries: string[];
  minStars?: number;
}

export class GitHubCrawler extends BaseCrawler {
  private octokit: Octokit;
  private crawlerConfig: GitHubCrawlerConfig;

  constructor(crawlerConfig: GitHubCrawlerConfig) {
    super("github");
    this.crawlerConfig = crawlerConfig;
    this.octokit = new Octokit({
      auth: config.GITHUB_TOKEN || undefined,
    });
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    const seen = new Set<string>();

    for (const query of this.crawlerConfig.searchQueries) {
      this.log.info({ query }, "Searching GitHub");

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        await githubLimiter.acquire();

        try {
          const response = await this.octokit.rest.search.repos({
            q: query,
            sort: "stars",
            order: "desc",
            per_page: 100,
            page,
          });

          const repos = response.data.items;
          if (repos.length === 0) {
            hasMore = false;
            break;
          }

          for (const repo of repos) {
            if (seen.has(repo.full_name)) continue;
            seen.add(repo.full_name);

            if (this.crawlerConfig.minStars && repo.stargazers_count < this.crawlerConfig.minStars) {
              continue;
            }

            const slug = slugify(repo.full_name);

            yield {
              server: {
                name: repo.name,
                slug,
                description: repo.description,
                repositoryUrl: repo.html_url,
                homepage: repo.homepage || null,
                author: repo.owner?.login || null,
                license: repo.license?.spdx_id || null,
                stars: repo.stargazers_count,
                metadata: {
                  source: "github",
                  fullName: repo.full_name,
                  topics: repo.topics,
                  language: repo.language,
                  defaultBranch: repo.default_branch,
                  forksCount: repo.forks_count,
                  openIssuesCount: repo.open_issues_count,
                  pushedAt: repo.pushed_at,
                },
              },
            };
          }

          // GitHub search API maxes out at 1000 results
          if (page * 100 >= Math.min(response.data.total_count, 1000)) {
            hasMore = false;
          }
          page++;
        } catch (err) {
          this.log.error({ query, page, err }, "GitHub search failed");
          hasMore = false;
        }
      }
    }
  }
}
