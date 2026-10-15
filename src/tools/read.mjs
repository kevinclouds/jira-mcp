import * as z from 'zod';
import { normalizePage } from '../lib/result.mjs';
import { pathSegment, success, withTool } from './helpers.mjs';

const annotations = (idempotent = false) => ({ readOnlyHint: true, destructiveHint: false, idempotentHint: idempotent, openWorldHint: true });
const page = {
  startAt: z.number().int().min(0).optional().describe('Index of the first result'),
  maxResults: z.number().int().min(1).max(1000).optional().describe('Page size (1-1000, default 50)'),
};

export function registerReadTools(server, { client, config }) {
  server.registerTool('jira_search_issues', {
    title: 'Search Issues',
    description: 'Search Jira issues with JQL, e.g. "project = KEY AND assignee = currentUser()". Omit fields to return all fields (can be large; pass fields to limit). expand takes an array.',
    inputSchema: z.strictObject({
      jql: z.string().describe('JQL expression'),
      fields: z.array(z.string()).optional().describe('Fields to return; omitted returns all fields'),
      expand: z.array(z.string()).optional().describe('Expand, e.g. ["changelog","renderedFields"]'),
      validateQuery: z.boolean().optional().describe('Validate the JQL query'),
      ...page,
    }),
    annotations: annotations(true),
  }, withTool('jira_search_issues', async (args) => {
    const paging = normalizePage(args);
    const body = { jql: args.jql, startAt: paging.startAt, maxResults: paging.maxResults };
    if (args.fields) body.fields = args.fields;
    if (args.expand) body.expand = args.expand;
    if (args.validateQuery !== undefined) body.validateQuery = args.validateQuery;
    return success('jira_search_issues', await client.request('POST', '/search', body));
  }));

  server.registerTool('jira_get_issue', {
    title: 'Get Issue',
    description: 'Get one Jira issue by key.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key, e.g. PROJ-123'),
      fields: z.string().optional().describe('Comma-separated fields'),
      expand: z.string().optional().describe('Expand, e.g. changelog,renderedFields'),
      properties: z.string().optional().describe('Comma-separated issue property keys'),
      updateHistory: z.boolean().optional().describe('Include the issue history in the response'),
    }),
    annotations: annotations(true),
  }, withTool('jira_get_issue', async (args) => {
    const params = new URLSearchParams();
    if (args.fields) params.set('fields', args.fields);
    if (args.expand) params.set('expand', args.expand);
    if (args.properties) params.set('properties', args.properties);
    if (args.updateHistory !== undefined) params.set('updateHistory', String(args.updateHistory));
    const query = params.toString();
    return success('jira_get_issue', await client.request('GET', `/issue/${pathSegment(args.issueKey)}${query ? `?${query}` : ''}`));
  }));

  server.registerTool('jira_get_issue_history', {
    title: 'Get Issue History',
    description: 'Get the changelog of an issue.',
    inputSchema: z.strictObject({ issueKey: z.string().describe('Issue key') }),
    annotations: annotations(),
  }, withTool('jira_get_issue_history', async (args) => {
    const issue = await client.request('GET', `/issue/${pathSegment(args.issueKey)}?expand=changelog&fields=`);
    return success('jira_get_issue_history', issue?.changelog ?? issue);
  }));

  server.registerTool('jira_get_issue_comments', {
    title: 'Get Issue Comments',
    description: 'List issue comments.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      orderBy: z.string().optional().describe('e.g. +created or -created'),
      expand: z.string().optional().describe('e.g. renderedBody'),
      ...page,
    }),
    annotations: annotations(),
  }, withTool('jira_get_issue_comments', async (args) => {
    const paging = normalizePage(args);
    const params = new URLSearchParams({ startAt: String(paging.startAt), maxResults: String(paging.maxResults) });
    if (args.orderBy) params.set('orderBy', args.orderBy);
    if (args.expand) params.set('expand', args.expand);
    return success('jira_get_issue_comments', await client.request('GET', `/issue/${pathSegment(args.issueKey)}/comment?${params}`));
  }));

  server.registerTool('jira_get_issue_transitions', {
    title: 'Get Issue Transitions',
    description: 'List available transitions for an issue. Use expand=transitions.fields to see the fields each transition screen requires.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      transitionId: z.string().optional().describe('Return a single transition by ID'),
      expand: z.string().optional().describe('e.g. transitions.fields'),
    }),
    annotations: annotations(),
  }, withTool('jira_get_issue_transitions', async (args) => {
    const params = new URLSearchParams();
    if (args.transitionId) params.set('transitionId', args.transitionId);
    if (args.expand) params.set('expand', args.expand);
    const query = params.toString();
    return success('jira_get_issue_transitions', await client.request('GET', `/issue/${pathSegment(args.issueKey)}/transitions${query ? `?${query}` : ''}`));
  }));

  server.registerTool('jira_get_worklogs', {
    title: 'Get Issue Worklogs',
    description: 'List worklogs of an issue.',
    inputSchema: z.strictObject({ issueKey: z.string().describe('Issue key') }),
    annotations: annotations(),
  }, withTool('jira_get_worklogs', async (args) => {
    return success('jira_get_worklogs', await client.request('GET', `/issue/${pathSegment(args.issueKey)}/worklog`));
  }));

  server.registerTool('jira_list_projects', {
    title: 'List Projects',
    description: 'List visible Jira projects. Pagination (startAt/maxResults) is applied locally — the Jira endpoint itself returns all projects.',
    inputSchema: z.strictObject({
      expand: z.string().optional().describe('e.g. description,lead,url,projectKeys'),
      recent: z.number().int().min(1).optional().describe('Return the N most recently viewed projects'),
      includeArchived: z.boolean().optional().describe('Include archived projects'),
      browseArchive: z.boolean().optional().describe('Browse archived projects'),
      ...page,
    }),
    annotations: annotations(),
  }, withTool('jira_list_projects', async (args) => {
    const paging = normalizePage(args);
    const params = new URLSearchParams();
    if (args.expand) params.set('expand', args.expand);
    if (args.recent !== undefined) params.set('recent', String(args.recent));
    if (args.includeArchived !== undefined) params.set('includeArchived', String(args.includeArchived));
    if (args.browseArchive !== undefined) params.set('browseArchive', String(args.browseArchive));
    const query = params.toString();
    const all = await client.request('GET', `/project${query ? `?${query}` : ''}`);
    if (Array.isArray(all)) {
      const data = all.slice(paging.startAt, paging.startAt + paging.maxResults);
      return success('jira_list_projects', data, { startAt: paging.startAt, maxResults: paging.maxResults, total: all.length });
    }
    return success('jira_list_projects', all);
  }));

  server.registerTool('jira_get_project', {
    title: 'Get Project',
    description: 'Get a Jira project.',
    inputSchema: z.strictObject({
      projectKey: z.string().describe('Project key'),
      expand: z.string().optional().describe('e.g. description,lead,url,projectKeys'),
    }),
    annotations: annotations(true),
  }, withTool('jira_get_project', async (args) => {
    const query = args.expand ? `?expand=${encodeURIComponent(args.expand)}` : '';
    return success('jira_get_project', await client.request('GET', `/project/${pathSegment(args.projectKey)}${query}`));
  }));

  server.registerTool('jira_list_issue_types', {
    title: 'List Issue Types',
    description: 'List all issue types.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_list_issue_types', async () => success('jira_list_issue_types', await client.request('GET', '/issuetype'))));

  server.registerTool('jira_list_priorities', {
    title: 'List Priorities',
    description: 'List all priorities.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_list_priorities', async () => success('jira_list_priorities', await client.request('GET', '/priority'))));

  server.registerTool('jira_list_statuses', {
    title: 'List Statuses',
    description: 'List all statuses.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_list_statuses', async () => success('jira_list_statuses', await client.request('GET', '/status'))));

  server.registerTool('jira_list_users', {
    title: 'Search Users',
    description: 'Search users — use this to find usernames for assignee fields.',
    inputSchema: z.strictObject({
      username: z.string().optional().describe('Username or query'),
      includeActive: z.boolean().optional().describe('Include active users'),
      includeInactive: z.boolean().optional().describe('Include inactive users'),
      ...page,
    }),
    annotations: annotations(),
  }, withTool('jira_list_users', async (args) => {
    const paging = normalizePage(args);
    const params = new URLSearchParams({ username: args.username || '', startAt: String(paging.startAt), maxResults: String(paging.maxResults) });
    if (args.includeActive !== undefined) params.set('includeActive', String(args.includeActive));
    if (args.includeInactive !== undefined) params.set('includeInactive', String(args.includeInactive));
    return success('jira_list_users', await client.request('GET', `/user/search?${params}`));
  }));

  server.registerTool('jira_list_versions', {
    title: 'List Project Versions',
    description: 'List project versions.',
    inputSchema: z.strictObject({
      projectKey: z.string().describe('Project key'),
      expand: z.string().optional().describe('e.g. operations'),
    }),
    annotations: annotations(),
  }, withTool('jira_list_versions', async (args) => {
    const query = args.expand ? `?expand=${encodeURIComponent(args.expand)}` : '';
    return success('jira_list_versions', await client.request('GET', `/project/${pathSegment(args.projectKey)}/versions${query}`));
  }));

  server.registerTool('jira_list_components', {
    title: 'List Project Components',
    description: 'List project components.',
    inputSchema: z.strictObject({ projectKey: z.string().describe('Project key') }),
    annotations: annotations(),
  }, withTool('jira_list_components', async (args) => {
    return success('jira_list_components', await client.request('GET', `/project/${pathSegment(args.projectKey)}/components`));
  }));

  server.registerTool('jira_get_capabilities', {
    title: 'Get MCP Capabilities',
    description: 'Show visible Jira capabilities and MCP write flags.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_get_capabilities', async () => {
    return success('jira_get_capabilities', { flags: { allowWrite: config.allowWrite, allowDelete: config.allowDelete }, note: 'Final capability is determined by Jira permissions.' });
  }));

  server.registerTool('jira_get_myself', {
    title: 'Get Current Account',
    description: 'Get the current Jira account.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_get_myself', async () => success('jira_get_myself', await client.request('GET', '/myself'))));

  server.registerTool('jira_get_server_info', {
    title: 'Get Server Info',
    description: 'Get Jira server version and deployment information.',
    inputSchema: z.strictObject({ doHealthCheck: z.boolean().optional().describe('Run a health check') }),
    annotations: annotations(),
  }, withTool('jira_get_server_info', async (args) => {
    const query = args.doHealthCheck !== undefined ? `?doHealthCheck=${args.doHealthCheck}` : '';
    return success('jira_get_server_info', await client.request('GET', `/serverInfo${query}`));
  }));

  server.registerTool('jira_list_fields', {
    title: 'List Fields',
    description: 'List all Jira fields, including custom fields.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_list_fields', async () => success('jira_list_fields', await client.request('GET', '/field'))));

  server.registerTool('jira_get_create_meta', {
    title: 'Get Create Metadata',
    description: 'Get create-issue field metadata for projects and issue types. Use before jira_create_issue to check available and required fields.',
    inputSchema: z.strictObject({
      projectKeys: z.string().optional().describe('Comma-separated project keys'),
      projectIds: z.string().optional().describe('Comma-separated project IDs'),
      issuetypeNames: z.string().optional().describe('Comma-separated issue type names'),
      issuetypeIds: z.string().optional().describe('Comma-separated issue type IDs'),
      expand: z.string().optional().describe('e.g. projects.issuetypes.fields'),
    }),
    annotations: annotations(),
  }, withTool('jira_get_create_meta', async (args) => {
    const params = new URLSearchParams();
    if (args.projectKeys) params.set('projectKeys', args.projectKeys);
    if (args.projectIds) params.set('projectIds', args.projectIds);
    if (args.issuetypeNames) params.set('issuetypeNames', args.issuetypeNames);
    if (args.issuetypeIds) params.set('issuetypeIds', args.issuetypeIds);
    if (args.expand) params.set('expand', args.expand);
    const query = params.toString();
    return success('jira_get_create_meta', await client.request('GET', `/issue/createmeta${query ? `?${query}` : ''}`));
  }));

  server.registerTool('jira_get_edit_meta', {
    title: 'Get Edit Metadata',
    description: 'Get editable fields for an issue. Use before jira_update_issue to check which fields can be set.',
    inputSchema: z.strictObject({ issueKey: z.string().describe('Issue key') }),
    annotations: annotations(),
  }, withTool('jira_get_edit_meta', async (args) => {
    return success('jira_get_edit_meta', await client.request('GET', `/issue/${pathSegment(args.issueKey)}/editmeta`));
  }));

  server.registerTool('jira_get_issue_link_types', {
    title: 'List Issue Link Types',
    description: 'List issue link types.',
    inputSchema: z.strictObject({}),
    annotations: annotations(),
  }, withTool('jira_get_issue_link_types', async () => success('jira_get_issue_link_types', await client.request('GET', '/issueLinkType'))));

  server.registerTool('jira_download_attachment', {
    title: 'Download Attachment',
    description: 'Download attachment content as base64. Only attachments hosted on the configured Jira instance are allowed.',
    inputSchema: z.strictObject({ attachmentId: z.string().describe('Attachment ID') }),
    annotations: annotations(),
  }, withTool('jira_download_attachment', async (args) => {
    const meta = await client.request('GET', `/attachment/${pathSegment(args.attachmentId)}`);
    const contentBase64 = await client.downloadContent(meta.content);
    return success('jira_download_attachment', { ...meta, contentBase64 });
  }));
}
