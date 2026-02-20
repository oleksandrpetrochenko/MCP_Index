# MCP Indexer - Implementation Plan: Starting from Crawler

## Decisions Made
- **Package manager**: pnpm
- **ORM**: Drizzle
- **Framework**: Fastify
- **Infra**: Docker Compose (Postgres+pgvector, Redis)

## What We're Building (Crawler-First)

Starting from the crawler means we need some foundational pieces, then the crawlers themselves. Here's the order:

### Step 1: Project Scaffolding
- Initialize pnpm project with TypeScript
- tsconfig.json, .env.example, .gitignore
- Docker Compose with PostgreSQL (pgvector) + Redis
- Install core dependencies (drizzle, fastify, bullmq, zod, octokit, etc.)

### Step 2: Config & Utils (minimal foundation)
- `src/config/index.ts` — env loader (dotenv + zod validation)
- `src/config/database.ts` — Drizzle connection setup
- `src/config/sources.ts` — default crawl source configs
- `src/utils/logger.ts` — pino logger (pairs with Fastify)
- `src/utils/http-client.ts` — fetch wrapper with retry + rate limiting
- `src/utils/rate-limiter.ts` — token bucket for GitHub/NPM API limits

### Step 3: Database Schema & Models
- Drizzle schema for: `mcp_servers`, `mcp_tools`, `mcp_resources`, `mcp_prompts`, `categories`, `crawl_sources`, `crawl_jobs`
- Initial migration
- Repository layer: `server-repo.ts`, `source-repo.ts`

### Step 4: Crawlers (the main focus)
- `src/crawler/base-crawler.ts` — abstract class with common crawl lifecycle (fetch, parse, dedupe, store)
- `src/crawler/github-crawler.ts` — GitHub topic + search via Octokit
- `src/crawler/npm-crawler.ts` — NPM registry search API
- `src/crawler/awesome-list-crawler.ts` — Parse markdown awesome lists for MCP server links
- `src/crawler/registry-crawler.ts` — Official MCP registry API
- `src/crawler/custom-url-crawler.ts` — Generic URL/feed crawler
- `src/crawler/index.ts` — Orchestrator that runs crawlers and manages results

### Step 5: Parsers (needed by crawlers to extract data)
- `src/parser/readme-parser.ts` — Extract description, install commands, capabilities from README
- `src/parser/package-json-parser.ts` — Extract metadata from package.json
- `src/parser/mcp-manifest-parser.ts` — Parse MCP manifest/config files
- `src/parser/capability-extractor.ts` — Extract tools/resources/prompts
- `src/parser/index.ts` — Orchestrator

### Step 6: Job Scheduling
- `src/scheduler/crawl-scheduler.ts` — BullMQ-based cron jobs for each crawl source
- `src/scheduler/maintenance.ts` — Stale data cleanup
- `src/scheduler/index.ts`

### Step 7: Minimal API (to trigger/monitor crawls)
- `POST /api/v1/admin/crawl` — trigger a crawl
- `GET /api/v1/admin/crawl/:jobId` — check crawl status
- `GET /api/v1/servers` — list indexed servers (basic, to verify crawl results)

### Step 8: Entry Point & Scripts
- `src/index.ts` — boots Fastify, connects DB, starts scheduler
- `scripts/seed-database.ts` — seed categories + default sources
- `scripts/run-crawler.ts` — manual one-shot crawl

## Files Created (estimated ~30-35 files)

## Not in Scope for This Phase
- Semantic search / embeddings
- Full search API
- WebSocket real-time updates
- Admin dashboard
- Auth middleware (beyond simple API key)
- Quality scoring (placeholder only)
