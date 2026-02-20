import { createChildLogger } from "../utils/logger.js";
import type { ToolInput, ResourceInput, PromptInput } from "../db/server-repo.js";

const log = createChildLogger("capability-extractor");

/**
 * Extracts MCP capabilities (tools, resources, prompts) from source code
 * or configuration files using pattern matching.
 */
export function extractCapabilitiesFromSource(content: string): {
  tools: ToolInput[];
  resources: ResourceInput[];
  prompts: PromptInput[];
} {
  const tools: ToolInput[] = [];
  const resources: ResourceInput[] = [];
  const prompts: PromptInput[] = [];

  try {
    // Match common patterns for tool registration
    // e.g., server.tool("name", "description", schema, handler)
    //        server.setRequestHandler(ListToolsRequestSchema, ...)
    const toolPatterns = [
      /server\.tool\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']/g,
      /name:\s*["']([^"']+)["'].*?description:\s*["']([^"']*?)["']/gs,
      /addTool\(\s*\{[^}]*name:\s*["']([^"']+)["'][^}]*description:\s*["']([^"']*?)["']/gs,
    ];

    for (const pattern of toolPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const description = match[2] || null;
        if (name && !tools.some((t) => t.name === name)) {
          tools.push({ name, description });
        }
      }
    }

    // Match resource patterns
    const resourcePatterns = [
      /server\.resource\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']/g,
      /uri:\s*["']([^"']+)["'].*?name:\s*["']([^"']*?)["']/gs,
    ];

    for (const pattern of resourcePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const uri = match[1];
        const name = match[2] || null;
        if (uri && !resources.some((r) => r.uri === uri)) {
          resources.push({ uri, name });
        }
      }
    }

    // Match prompt patterns
    const promptPatterns = [
      /server\.prompt\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']/g,
      /addPrompt\(\s*\{[^}]*name:\s*["']([^"']+)["'][^}]*description:\s*["']([^"']*?)["']/gs,
    ];

    for (const pattern of promptPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const description = match[2] || null;
        if (name && !prompts.some((p) => p.name === name)) {
          prompts.push({ name, description });
        }
      }
    }
  } catch (err) {
    log.error({ err }, "Failed to extract capabilities from source");
  }

  return { tools, resources, prompts };
}
