import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { fetchText } from "../utils/http-client.js";
import * as cheerio from "cheerio";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface CustomUrlConfig {
  urls: string[];
}

export class CustomUrlCrawler extends BaseCrawler {
  private crawlerConfig: CustomUrlConfig;

  constructor(crawlerConfig: CustomUrlConfig) {
    super("custom-url");
    this.crawlerConfig = crawlerConfig;
  }

  private parseHtmlForLinks(html: string, baseUrl: string): Array<{ name: string; url: string; description: string }> {
    const $ = cheerio.load(html);
    const links: Array<{ name: string; url: string; description: string }> = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();

      if (
        (href.includes("github.com") || href.includes("npmjs.com")) &&
        text.length > 0
      ) {
        const parent = $(el).parent();
        const description = parent.text().replace(text, "").trim().slice(0, 500);

        const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).toString();

        links.push({
          name: text,
          url: fullUrl,
          description,
        });
      }
    });

    return links;
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    const seen = new Set<string>();

    for (const url of this.crawlerConfig.urls) {
      this.log.info({ url }, "Fetching custom URL");

      try {
        const content = await fetchText(url);
        const links = this.parseHtmlForLinks(content, url);

        for (const link of links) {
          const slug = slugify(link.name);
          if (seen.has(slug)) continue;
          seen.add(slug);

          const ghMatch = link.url.match(/github\.com\/([^/]+)\/([^/]+)/);

          yield {
            server: {
              name: link.name,
              slug,
              description: link.description || null,
              repositoryUrl: ghMatch ? link.url : null,
              author: ghMatch?.[1] || null,
              metadata: {
                source: "custom-url",
                sourceUrl: url,
              },
            },
          };
        }
      } catch (err) {
        this.log.error({ url, err }, "Failed to fetch custom URL");
      }
    }
  }
}
