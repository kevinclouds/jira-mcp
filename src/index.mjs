#!/usr/bin/env node
import { startServer } from './server.mjs';

startServer().catch((error) => {
  process.stderr.write(`jira-mcp: ${error.message}\n`);
  process.exitCode = 1;
});
