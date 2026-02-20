# MCP Index

A crawl-and-index system for discovering [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers. Aggregates MCP servers from NPM, GitHub, and curated awesome-lists, scores them by quality, and exposes the index as both a REST API and an MCP server for AI assistant discovery.

## Features

- **Multi-source crawling** — NPM registry, GitHub topic search, awesome-mcp-servers list
- **Noise filtering** — Only indexes packages that are actually MCP servers
- **Quality scoring** — 5-signal weighted ranking (popularity, freshness, completeness, MCP compliance, community)
- **REST API** — Fastify-based API for searching and browsing servers
- **MCP server** — Exposes the index via MCP protocol (stdio + SSE transports) so Claude Desktop, Cursor, and other MCP clients can discover servers
- **Scheduled crawling** — BullMQ-based job scheduling with configurable cron intervals

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **API**: Fastify
- **Database**: PostgreSQL (pgvector image) + Drizzle ORM
- **Queue**: BullMQ + Redis
- **MCP SDK**: @modelcontextprotocol/sdk
- **Package manager**: pnpm

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-username>/mcp-index.git
cd mcp-index

# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — add your GITHUB_TOKEN for GitHub crawler

# Push database schema
pnpm db:push

# Seed categories and crawl sources
pnpm seed

# Run crawlers
pnpm crawl

# Run quality scorer
pnpm mcp:score
```

### Run the API

```bash
pnpm dev          # Development with hot reload
pnpm build && pnpm start  # Production
```

API available at `http://localhost:3000/api/v1/servers`

### Use as MCP Server

#### Claude Desktop / Cursor (stdio)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-index": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-index/src/mcp/stdio-transport.ts"],
      "env": {
        "DATABASE_URL": "postgresql://mcp:mcp_secret@localhost:5432/mcp_index"
      }
    }
  }
}
```

#### SSE Transport (network)

When running the API server (`pnpm dev`), the SSE endpoint is available at:
- `GET http://localhost:3000/mcp/sse` — SSE connection
- `POST http://localhost:3000/mcp/messages?sessionId=<id>` — Client messages

### MCP Tools Available

| Tool | Description |
|---|---|
| `search_servers` | Search MCP servers by query, category, sort order |
| `get_server` | Get full details of a server by slug |
| `list_categories` | List all categories with server counts |
| `get_index_stats` | Index statistics and top categories |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start API server with hot reload |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled server |
| `pnpm crawl` | Run all crawlers |
| `pnpm crawl <source>` | Run specific crawler (e.g., `github-mcp-topic`) |
| `pnpm seed` | Seed categories and crawl sources |
| `pnpm mcp` | Start MCP server (stdio) |
| `pnpm mcp:score` | Run quality scorer on all servers |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Drizzle Studio |

## License

MIT
