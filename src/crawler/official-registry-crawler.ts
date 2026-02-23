import { BaseCrawler, type CrawlResult } from "./base-crawler.js";
import { fetchJson } from "../utils/http-client.js";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Official Registry API Types ────────────────────────────────

interface RegistryServerResponse {
  server: RegistryServerJSON;
  _meta: {
    "io.modelcontextprotocol.registry/official"?: {
      status: string;
      publishedAt: string;
      updatedAt: string;
      isLatest: boolean;
    };
  };
}

interface RegistryServerJSON {
  name: string;
  title?: string;
  description: string;
  version: string;
  websiteUrl?: string;
  repository?: {
    source: string;
    url: string;
    id: string;
    subfolder?: string;
  };
  packages?: RegistryPackage[];
  remotes?: Array<{ type: string }>;
}

interface RegistryPackage {
  registryType: string; // "npm" | "pypi" | "oci" | "nuget" | "mcpb"
  identifier: string;
  version: string;
  transport: { type: string };
  runtimeHint?: string;
  runtimeArguments?: Array<{ name: string; value?: string }>;
  environmentVariables?: Array<{ name: string; description?: string }>;
}

interface RegistryListResponse {
  servers: RegistryServerResponse[] | null;
  metadata: {
    count: number;
    nextCursor?: string;
  };
}

// ── Configuration ──────────────────────────────────────────────

interface OfficialRegistryCrawlerConfig {
  baseUrl?: string;
  limit?: number;
  maxPages?: number;
  updatedSince?: string; // RFC3339 date for delta sync
}

// ── Crawler ────────────────────────────────────────────────────

export class OfficialRegistryCrawler extends BaseCrawler {
  private config: Required<
    Pick<OfficialRegistryCrawlerConfig, "baseUrl" | "limit" | "maxPages">
  > &
    OfficialRegistryCrawlerConfig;

  constructor(config: OfficialRegistryCrawlerConfig) {
    super("official-registry");
    this.config = {
      baseUrl: config.baseUrl || "https://registry.modelcontextprotocol.io",
      limit: config.limit || 100,
      maxPages: config.maxPages || 500,
      updatedSince: config.updatedSince,
    };
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    this.log.info(
      { baseUrl: this.config.baseUrl, limit: this.config.limit },
      "Starting official MCP registry sync",
    );

    let cursor: string | undefined;
    let pageCount = 0;
    let totalFetched = 0;

    do {
      pageCount++;
      if (pageCount > this.config.maxPages) {
        this.log.warn(
          { maxPages: this.config.maxPages },
          "Hit max pages limit, stopping pagination",
        );
        break;
      }

      // Build URL with query parameters
      const url = new URL(`/v0/servers`, this.config.baseUrl);
      url.searchParams.set("limit", String(this.config.limit));
      if (cursor) url.searchParams.set("cursor", cursor);
      if (this.config.updatedSince)
        url.searchParams.set("updated_since", this.config.updatedSince);

      this.log.info(
        { page: pageCount, cursor: cursor || "start" },
        "Fetching registry page",
      );

      let response: RegistryListResponse;
      try {
        response = await fetchJson<RegistryListResponse>(url.toString(), {
          timeout: 60000,
        });
      } catch (err) {
        this.log.error({ err, page: pageCount }, "Failed to fetch registry page");
        break;
      }

      const servers = response.servers || [];
      totalFetched += servers.length;

      this.log.info(
        {
          page: pageCount,
          serversOnPage: servers.length,
          totalFetched,
          hasMore: !!response.metadata.nextCursor,
        },
        "Registry page fetched",
      );

      for (const entry of servers) {
        const result = this.mapServerToCrawlResult(entry);
        if (result) {
          yield result;
        }
      }

      cursor = response.metadata.nextCursor;
    } while (cursor);

    this.log.info(
      { totalFetched, pages: pageCount },
      "Official registry sync complete",
    );
  }

  private mapServerToCrawlResult(
    entry: RegistryServerResponse,
  ): CrawlResult | null {
    const srv = entry.server;

    // Skip deprecated/deleted servers
    const meta =
      entry._meta?.["io.modelcontextprotocol.registry/official"];
    if (meta && (meta.status === "deprecated" || meta.status === "deleted")) {
      return null;
    }

    // Build slug from name (reverse-DNS format: "io.github.user/weather")
    const slug = slugify(srv.name);

    // Extract npm package from packages array
    const npmPkg = srv.packages?.find((p) => p.registryType === "npm");
    const npmPackage = npmPkg?.identifier || null;

    // Build install command based on package type
    let installCommand: string | null = null;
    if (npmPkg) {
      const runtime = npmPkg.runtimeHint || "npx";
      installCommand = `${runtime} ${npmPkg.identifier}`;
    } else {
      const pypiPkg = srv.packages?.find((p) => p.registryType === "pypi");
      if (pypiPkg) {
        installCommand = `uvx ${pypiPkg.identifier}`;
      }
    }

    // Determine transport type
    const transport =
      npmPkg?.transport?.type ||
      srv.packages?.[0]?.transport?.type ||
      srv.remotes?.[0]?.type ||
      null;

    return {
      server: {
        name: srv.title || srv.name,
        slug,
        description: srv.description || null,
        repositoryUrl: srv.repository?.url || null,
        npmPackage,
        homepage: srv.websiteUrl || null,
        author: null, // Official registry doesn't have separate author field
        version: srv.version || null,
        installCommand,
        isOfficial: true,
        metadata: {
          source: "official-registry",
          registryName: srv.name,
          transport,
          registryStatus: meta?.status || "active",
          publishedAt: meta?.publishedAt || null,
          updatedAt: meta?.updatedAt || null,
          packageTypes: srv.packages?.map((p) => p.registryType) || [],
        },
      },
      // Note: The official registry v0 API doesn't expose tool/resource/prompt details
      // Those would need to be fetched by connecting to each server individually
    };
  }
}
