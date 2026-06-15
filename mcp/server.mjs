#!/usr/bin/env node
// Forge MCP server (stdio). Thin SDK wrapper around core/mcp-tools.mjs so Claude Code can
// drive the harness and feed visual audits into the loop. Run: `npm run mcp`.
// Low-level Server (not the higher-level McpServer) is intentional: it lets tools accept
// arbitrary args (additionalProperties) for generic passthrough to callTool, rather than
// declaring a per-tool zod schema for each of the nine tools.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "../core/mcp-tools.mjs";

const server = new Server({ name: "forge", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: { type: "object", properties: {}, additionalProperties: true },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const result = await callTool(req.params.name, req.params.arguments || {});
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

await server.connect(new StdioServerTransport());
