import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './lib/config.mjs';
import { JiraClient } from './lib/jira-client.mjs';
import { WriteGuard } from './lib/guard.mjs';
import { registerReadTools } from './tools/read.mjs';
import { registerWriteTools } from './tools/write.mjs';
import { registerDeleteTools } from './tools/delete.mjs';

export function createServer(config, fetchImpl) {
  const client = new JiraClient(config, fetchImpl);
  const guard = new WriteGuard(config);
  const context = { client, guard, config };
  const server = new McpServer({ name: 'jira-mcp', version: '0.1.0' });
  registerReadTools(server, context);
  if (config.allowWrite) registerWriteTools(server, context);
  if (config.allowWrite && config.allowDelete) registerDeleteTools(server, context);
  return server;
}

export async function startServer(argv = process.argv.slice(2), env = process.env) {
  const config = loadConfig(argv, env);
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
