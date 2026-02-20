import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "mcp-index",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  registerTools(server);
  registerResources(server);

  return server;
}
