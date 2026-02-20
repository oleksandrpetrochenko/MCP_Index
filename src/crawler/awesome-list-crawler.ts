import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { fetchText } from "../utils/http-client.js";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface AwesomeListConfig {
  urls: string[];
}

interface ParsedEntry {
  name: string;
  url: string;
  description: string;
  category?: string;
}

export class AwesomeListCrawler extends BaseCrawler {
  private crawlerConfig: AwesomeListConfig;

  constructor(crawlerConfig: AwesomeListConfig) {
    super("awesome-list");
    this.crawlerConfig = crawlerConfig;
  }

  private parseMarkdown(markdown: string): ParsedEntry[] {
    const entries: ParsedEntry[] = [];
    const lines = markdown.split("\n");
    let currentCategory = "";

    for (const line of lines) {
      // Track headings as categories
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        currentCategory = headingMatch[1].trim();
        continue;
      }

      // Match markdown list items with links: - [Name](url) - description
      const entryMatch = line.match(
        /^[\s]*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—:]?\s*(.*)/,
      );
      if (entryMatch) {
        const [, name, url, description] = entryMatch;

        // Only include GitHub repos or npm links
        if (
          url.includes("github.com") ||
          url.includes("npmjs.com") ||
          url.includes("gitlab.com")
        ) {
          entries.push({
            name: name.trim(),
            url: url.trim(),
            description: description.trim(),
            category: currentCategory,
          });
        }
      }
    }

    return entries;
  }

  private extractRepoInfo(url: string): { author: string; repoName: string } | null {
    const ghMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) {
      return { author: ghMatch[1], repoName: ghMatch[2].replace(/\.git$/, "") };
    }
    return null;
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    const seen = new Set<string>();

    for (const url of this.crawlerConfig.urls) {
      this.log.info({ url }, "Fetching awesome list");

      try {
        const markdown = await fetchText(url);
        const entries = this.parseMarkdown(markdown);

        this.log.info({ url, count: entries.length }, "Parsed entries from awesome list");

        for (const entry of entries) {
          const repoInfo = this.extractRepoInfo(entry.url);
          const slug = repoInfo
            ? slugify(`${repoInfo.author}-${repoInfo.repoName}`)
            : slugify(entry.name);

          if (seen.has(slug)) continue;
          seen.add(slug);

          yield {
            server: {
              name: entry.name,
              slug,
              description: entry.description || null,
              repositoryUrl: entry.url.includes("github.com") || entry.url.includes("gitlab.com")
                ? entry.url
                : null,
              author: repoInfo?.author || null,
              metadata: {
                source: "awesome-list",
                sourceUrl: url,
                originalCategory: entry.category,
              },
            },
          };
        }
      } catch (err) {
        this.log.error({ url, err }, "Failed to fetch/parse awesome list");
      }
    }
  }
}
