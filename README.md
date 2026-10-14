# jira-mcp

A local stdio [MCP](https://modelcontextprotocol.io/) server for **Jira Server / Data Center**. Connect MCP clients (Claude, Codex, Cursor, VS Code, opencode, …) to your Jira instance through the REST API v2 — search, create, update, comment, transition, log work, and more, all through natural language.

Verified against Jira Server 8.13.5. Jira Cloud is only partially compatible (API token authentication, no session fallback).

[中文说明](README.zh-CN.md)

## Features

- **41 tools** — 22 read-only, 16 write, 3 delete (see [Tools](#tools))
- **Read-only by default** — writes require `--allow-write`, deletes require `--allow-write --allow-delete`
- **Safe by design** — the server never bypasses Jira permissions; 401/403/404 are mapped to explicit error codes with suggestions
- **Basic auth with session fallback** — automatically falls back to session-cookie auth when Basic auth is rejected
- **Field discovery helpers** — `jira_get_create_meta` / `jira_get_edit_meta` list the fields available on your project screens
- **Structured results** — every tool returns `structuredContent` plus a text summary
- **No credential leakage** — credentials come from env vars or CLI args only; never logged, never echoed in errors
- Built on the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (v2)

## Requirements

- Node.js >= 20
- A reachable Jira Server / Data Center instance (REST API v2)

## Quick start

Standard configuration (works in most clients):

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "github:kevinclouds/jira-mcp#v0.1.0"],
      "env": {
        "JIRA_URL": "https://jira.example.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_PASSWORD": "your-password"
      }
    }
  }
}
```

Pin a reviewed tag or commit SHA in production — avoid mutable branches.

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add jira \
  -e JIRA_URL=https://jira.example.com \
  -e JIRA_USERNAME=your-username \
  -e JIRA_PASSWORD=your-password \
  -- npx -y github:kevinclouds/jira-mcp#v0.1.0
```
</details>

<details>
<summary><b>Codex</b></summary>

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.jira]
command = "npx"
args = ["-y", "github:kevinclouds/jira-mcp#v0.1.0"]

[mcp_servers.jira.env]
JIRA_URL = "https://jira.example.com"
JIRA_USERNAME = "your-username"
JIRA_PASSWORD = "your-password"
```
</details>

<details>
<summary><b>VS Code</b></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "github:kevinclouds/jira-mcp#v0.1.0"],
      "env": {
        "JIRA_URL": "https://jira.example.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_PASSWORD": "your-password"
      }
    }
  }
}
```
</details>

<details>
<summary><b>opencode</b></summary>

Add to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "jira": {
      "type": "local",
      "command": ["npx", "-y", "github:kevinclouds/jira-mcp#v0.1.0"],
      "environment": {
        "JIRA_URL": "https://jira.example.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_PASSWORD": "your-password"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Local checkout (no npx)</b></summary>

```sh
git clone https://github.com/kevinclouds/jira-mcp.git
cd jira-mcp
npm install        # installs the MCP SDK and builds dist via prepare
```

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/jira-mcp/dist/index.mjs"],
      "env": {
        "JIRA_URL": "https://jira.example.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_PASSWORD": "your-password"
      }
    }
  }
}
```
</details>

## Configuration

### Environment variables (recommended)

| Variable | Description |
|---|---|
| `JIRA_URL` | Jira base URL |
| `JIRA_USERNAME` | Account username |
| `JIRA_PASSWORD` | Account password (API token on Jira Cloud) |

### CLI arguments (compatible, higher priority than env vars)

| Argument | Description |
|---|---|
| `--url` / `--username` / `--password` | Same as the env vars above |
| `--allow-write` | Register the 16 write tools |
| `--allow-delete` | With `--allow-write`, register the 3 delete tools |
| `--no-session-fallback` | Disable session-cookie fallback on 401 |

Note: CLI arguments may be visible in process listings — prefer environment variables.

## Tools

Full JSON schemas are discoverable via `tools/list`. Read-only tools are registered by default; write tools require `--allow-write`; delete tools require `--allow-write --allow-delete`.

<details>
<summary><b>Read-only (22)</b></summary>

- `jira_search_issues` — Search Jira issues with JQL
- `jira_get_issue` — Get one Jira issue by key
- `jira_get_issue_history` — Get the changelog of an issue
- `jira_get_issue_comments` — List issue comments
- `jira_get_issue_transitions` — List available transitions for an issue
- `jira_get_worklogs` — List worklogs of an issue
- `jira_list_projects` — List visible Jira projects
- `jira_get_project` — Get a Jira project
- `jira_list_issue_types` — List all issue types
- `jira_list_priorities` — List all priorities
- `jira_list_statuses` — List all statuses
- `jira_list_users` — Search users
- `jira_list_versions` — List project versions
- `jira_list_components` — List project components
- `jira_get_myself` — Get the current Jira account
- `jira_get_server_info` — Get Jira server version and deployment information
- `jira_list_fields` — List all Jira fields, including custom fields
- `jira_get_create_meta` — Get create-issue field metadata for a project and issue type
- `jira_get_edit_meta` — Get the editable fields of an issue
- `jira_get_issue_link_types` — List issue link types
- `jira_download_attachment` — Download attachment content as base64
- `jira_get_capabilities` — Show the MCP write flags for this session
</details>

<details>
<summary><b>Write (16, requires --allow-write)</b></summary>

- `jira_create_issue` — Create an issue (full field set, incl. custom fields)
- `jira_update_issue` — Update issue fields
- `jira_clone_issue` — Clone an issue into another project
- `jira_update_issue_assignee` — Change the assignee
- `jira_update_issue_labels` — Replace labels
- `jira_update_issue_priority` — Change priority
- `jira_update_issue_components` — Replace components
- `jira_add_comment` — Add a comment
- `jira_edit_comment` — Edit a comment
- `jira_upload_attachment` — Upload an attachment (base64)
- `jira_add_worklog` — Add a worklog entry
- `jira_link_issues` — Link two issues
- `jira_create_issue_link` — Create a remote issue link
- `jira_transition_issue` — Transition an issue
- `jira_bulk_update_issues` — Update up to 50 issues with the same fields
- `jira_bulk_transition_issues` — Transition up to 50 issues
</details>

<details>
<summary><b>Delete (3, requires --allow-write --allow-delete)</b></summary>

- `jira_delete_issue` — Delete an issue
- `jira_delete_comment` — Delete a comment
- `jira_delete_attachment` — Delete an attachment
</details>

## Security

- Credentials are read from environment variables or CLI arguments only — they are never written to disk by this server, logged, or included in error messages
- The server never bypasses Jira permissions; every operation is subject to the authenticated account's actual permissions
- Errors are mapped to explicit codes: `JIRA_AUTHENTICATION_FAILED`, `JIRA_PERMISSION_DENIED`, `JIRA_RESOURCE_NOT_FOUND`, `JIRA_INVALID_REQUEST`, `JIRA_SERVER_ERROR`, `JIRA_NETWORK_ERROR`
- Attachment downloads are restricted to URLs on the configured Jira host
- No telemetry, no third-party services — the server only talks to the Jira URL you configure

## Known constraints

- Suppressing notifications (`notifyUsers=false`) requires Jira administrator or project administrator permission; regular accounts receive a 403
- Optional fields must be enabled on the project's create/edit screens; check with `jira_get_create_meta` / `jira_get_edit_meta` before setting them
- Deleting issues, creating projects and similar operations depend on the account's permissions
- On Jira Server 8.13, the issue changelog is fetched via `expand=changelog` (no standalone changelog endpoint)

## Development

```sh
npm install        # installs dependencies and builds dist (prepare)
npm run build      # rebuild dist
npm run release-check  # secret-pattern scan + npm audit
```

Project layout:

```
src/
  index.mjs        # stdio entry point
  server.mjs       # McpServer assembly and tool registration
  lib/             # config, guard, Jira REST client, result helpers
  tools/           # tool definitions by domain: read / write / delete
scripts/           # build and release checks
```

## License

MIT — see the [LICENSE](LICENSE) file.
