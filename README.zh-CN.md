# jira-mcp

本地 `stdio` [MCP](https://modelcontextprotocol.io/) 服务，面向 **Jira Server / Data Center**。让 MCP 客户端（Claude、Codex、Cursor、VS Code、opencode 等）通过 Jira REST API v2 用自然语言操作 Jira——查询、创建、更新、评论、流转、登记工时等。

已在 Jira Server 8.13.5 上完成验证。Jira Cloud 仅部分兼容（API Token 认证，无 Session 回退）。

[English](README.md)

## 特性

- **41 个工具**——22 个只读、16 个写入、3 个删除（见[工具清单](#工具)）
- **默认只读**——写入需要 `--allow-write`，删除需要 `--allow-write --allow-delete`
- **安全设计**——不绕过 Jira 权限；401/403/404 映射为明确错误码与处理建议
- **Basic Auth + Session 回退**——Basic 被拒时自动回退到 Session Cookie 认证
- **字段发现工具**——`jira_get_create_meta` / `jira_get_edit_meta` 可查询项目屏幕上可用的字段
- **结构化返回**——每个工具返回 `structuredContent` + 文本摘要
- **凭据零泄漏**——凭据只来自环境变量或启动参数；不写盘、不进日志、不出现在错误信息中
- 基于官方 [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)（v2）

## 环境要求

- Node.js >= 20
- 可访问的 Jira Server / Data Center 实例（REST API v2）

## 快速开始

标准配置（适用于大多数客户端）：

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

生产环境请固定已审核的 tag 或 commit SHA，不要使用可变分支。

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

编辑 `~/.codex/config.toml`：

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

编辑 `.vscode/mcp.json`：

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

编辑 `~/.config/opencode/opencode.json`：

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
<summary><b>本地克隆（不用 npx）</b></summary>

```sh
git clone https://github.com/kevinclouds/jira-mcp.git
cd jira-mcp
npm install        # 安装 MCP SDK 依赖，并通过 prepare 构建 dist
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

## 配置

### 环境变量（推荐）

| 变量 | 说明 |
|---|---|
| `JIRA_URL` | Jira 地址 |
| `JIRA_USERNAME` | 账号 |
| `JIRA_PASSWORD` | 密码（Cloud 场景为 API Token） |

### CLI 参数（兼容，优先级高于环境变量）

| 参数 | 说明 |
|---|---|
| `--url` / `--username` / `--password` | 同上方环境变量 |
| `--allow-write` | 注册 16 个写入工具 |
| `--allow-delete` | 配合 `--allow-write` 注册 3 个删除工具 |
| `--no-session-fallback` | 关闭 401 时的 Session 回退 |

注意：CLI 参数可能出现在进程列表中，正式使用推荐环境变量。

## 工具

完整 JSON Schema 可通过 `tools/list` 获取。只读工具默认注册；写入工具需要 `--allow-write`；删除工具需要 `--allow-write --allow-delete`。

<details>
<summary><b>只读（22）</b></summary>

- `jira_search_issues` — 用 JQL 搜索 Issue
- `jira_get_issue` — 按 Key 获取 Issue 详情
- `jira_get_issue_history` — 获取 Issue 变更历史
- `jira_get_issue_comments` — 列出 Issue 评论
- `jira_get_issue_transitions` — 列出 Issue 可用流转
- `jira_get_worklogs` — 列出 Issue 工时
- `jira_list_projects` — 列出可见项目
- `jira_get_project` — 获取项目详情
- `jira_list_issue_types` — 列出 Issue 类型
- `jira_list_priorities` — 列出优先级
- `jira_list_statuses` — 列出状态
- `jira_list_users` — 搜索用户
- `jira_list_versions` — 列出项目版本
- `jira_list_components` — 列出项目组件
- `jira_get_myself` — 获取当前账号信息
- `jira_get_server_info` — 获取 Jira 版本与部署信息
- `jira_list_fields` — 列出全部字段（含自定义字段）
- `jira_get_create_meta` — 查询创建 Issue 的字段元数据
- `jira_get_edit_meta` — 查询 Issue 的可编辑字段
- `jira_get_issue_link_types` — 列出关联类型
- `jira_download_attachment` — 下载附件内容（Base64）
- `jira_get_capabilities` — 显示本次会话的 MCP 写入开关
</details>

<details>
<summary><b>写入（16，需 --allow-write）</b></summary>

- `jira_create_issue` — 创建 Issue（全字段，含自定义字段）
- `jira_update_issue` — 更新 Issue 字段
- `jira_clone_issue` — 克隆 Issue 到目标项目
- `jira_update_issue_assignee` — 修改经办人
- `jira_update_issue_labels` — 整体替换标签
- `jira_update_issue_priority` — 修改优先级
- `jira_update_issue_components` — 整体替换组件
- `jira_add_comment` — 添加评论
- `jira_edit_comment` — 编辑评论
- `jira_upload_attachment` — 上传附件（Base64）
- `jira_add_worklog` — 登记工时
- `jira_link_issues` — 关联两个 Issue
- `jira_create_issue_link` — 创建远程链接
- `jira_transition_issue` — 执行状态流转
- `jira_bulk_update_issues` — 批量更新（最多 50 个）
- `jira_bulk_transition_issues` — 批量流转（最多 50 个）
</details>

<details>
<summary><b>删除（3，需 --allow-write --allow-delete）</b></summary>

- `jira_delete_issue` — 删除 Issue
- `jira_delete_comment` — 删除评论
- `jira_delete_attachment` — 删除附件
</details>

## 安全

- 凭据只来自环境变量或启动参数——服务本身不写盘、不进日志、不出现在错误信息中
- 不绕过 Jira 权限；每个操作都受当前账号实际权限约束
- 错误映射为明确错误码：`JIRA_AUTHENTICATION_FAILED`、`JIRA_PERMISSION_DENIED`、`JIRA_RESOURCE_NOT_FOUND`、`JIRA_INVALID_REQUEST`、`JIRA_SERVER_ERROR`、`JIRA_NETWORK_ERROR`
- 附件下载限制为与配置的 Jira 主机同源
- 无遥测、无第三方服务——只访问你配置的 Jira 地址

## 已知约束

- 关闭通知（`notifyUsers=false`）需要 Jira 管理员或项目管理员权限，普通账号会收到 403
- 可选字段需在项目创建/编辑屏幕上启用；设置前可用 `jira_get_create_meta` / `jira_get_edit_meta` 查询
- 删除 Issue、创建项目等操作取决于账号权限
- Jira Server 8.13 的 Issue 变更历史需通过 `expand=changelog` 获取（无独立 changelog 端点）

## 开发

```sh
npm install        # 安装依赖并通过 prepare 构建 dist
npm run build      # 重新构建 dist
npm run release-check  # 敏感模式扫描 + npm audit
```

项目结构：

```
src/
  index.mjs        # stdio 入口
  server.mjs       # McpServer 组装与工具注册
  lib/             # 配置、守卫、Jira REST 客户端、结果格式化
  tools/           # 工具定义按域拆分：read / write / delete
scripts/           # 构建与发布检查
```

## 许可证

MIT——见 [LICENSE](LICENSE) 文件。
