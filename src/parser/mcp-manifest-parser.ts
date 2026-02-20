import { createChildLogger } from "../utils/logger.js";
import type { ToolInput, ResourceInput, PromptInput } from "../db/server-repo.js";

const log = createChildLogger("mcp-manifest-parser");

export interface McpManifest {
  name?: string;
  description?: string;
  version?: string;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  resources?: Array<{
    uri: string;
    name?: string;
    description?: string;
    mimeType?: string;
  }>;
  prompts?: Array<{
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
}

export interface ParsedManifest {
  name: string | null;
  description: string | null;
  version: string | null;
  tools: ToolInput[];
  resources: ResourceInput[];
  prompts: PromptInput[];
}

export function parseMcpManifest(raw: string | Record<string, unknown>): ParsedManifest | null {
  try {
    const manifest: McpManifest = typeof raw === "string" ? JSON.parse(raw) : raw;

    return {
      name: manifest.name || null,
      description: manifest.description || null,
      version: manifest.version || null,
      tools: (manifest.tools || []).map((t) => ({
        name: t.name,
        description: t.description || null,
        inputSchema: t.inputSchema,
      })),
      resources: (manifest.resources || []).map((r) => ({
        uri: r.uri,
        name: r.name || null,
        description: r.description || null,
        mimeType: r.mimeType || null,
      })),
      prompts: (manifest.prompts || []).map((p) => ({
        name: p.name,
        description: p.description || null,
        arguments: p.arguments,
      })),
    };
  } catch (err) {
    log.error({ err }, "Failed to parse MCP manifest");
    return null;
  }
}
