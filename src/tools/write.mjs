import * as z from 'zod';
import { pathSegment, makeGuarded, success, withTool } from './helpers.mjs';

const annotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

export function registerWriteTools(server, { client, guard, config }) {
  const guarded = makeGuarded(client, guard);

  server.registerTool('jira_create_issue', {
    title: 'Create Issue',
    description: 'Create a Jira issue. Use jira_get_create_meta to list the available fields for the project and issue type.',
    inputSchema: z.strictObject({
      projectKey: z.string().describe('Project key'),
      issueType: z.string().describe('Issue type name'),
      summary: z.string().describe('Issue summary'),
      description: z.string().optional(),
      labels: z.array(z.string()).optional(),
      priority: z.string().optional().describe('Priority name'),
      assignee: z.string().optional().describe('Username'),
      components: z.array(z.string()).optional().describe('Component names'),
      fixVersions: z.array(z.string()).optional().describe('Fix version names'),
      duedate: z.string().optional().describe('Due date (yyyy-MM-dd)'),
      originalEstimate: z.string().optional().describe('e.g. 3w 4d 12h'),
      remainingEstimate: z.string().optional().describe('e.g. 3w 4d 12h'),
      environment: z.string().optional(),
      parent: z.string().optional().describe('Parent issue key (for subtasks)'),
      updateHistory: z.boolean().optional().describe('Include the create in the issue history'),
      customFields: z.record(z.string(), z.unknown()).optional().describe('Custom fields by ID, e.g. {"customfield_10000": "PROJ-1"}'),
      update: z.record(z.string(), z.unknown()).optional().describe('Field update operations (advanced)'),
      properties: z.array(z.record(z.string(), z.unknown())).optional().describe('Issue properties [{key,value}]'),
      historyMetadata: z.record(z.string(), z.unknown()).optional().describe('History metadata (advanced)'),
    }),
    annotations,
  }, withTool('jira_create_issue', async (args) => {
    guard.assertEnabled('create');
    const fields = { project: { key: args.projectKey }, issuetype: { name: args.issueType }, summary: args.summary };
    if (args.description) fields.description = args.description;
    if (args.labels) fields.labels = args.labels;
    if (args.priority) fields.priority = { name: args.priority };
    if (args.assignee) fields.assignee = { name: args.assignee };
    if (args.components) fields.components = args.components.map((name) => ({ name }));
    if (args.fixVersions) fields.fixVersions = args.fixVersions.map((name) => ({ name }));
    if (args.duedate) fields.duedate = args.duedate;
    if (args.environment) fields.environment = args.environment;
    if (args.parent) fields.parent = { key: args.parent };
    if (args.originalEstimate || args.remainingEstimate) {
      fields.timetracking = {};
      if (args.originalEstimate) fields.timetracking.originalEstimate = args.originalEstimate;
      if (args.remainingEstimate) fields.timetracking.remainingEstimate = args.remainingEstimate;
    }
    if (args.customFields) Object.assign(fields, args.customFields);
    const body = { fields };
    if (args.update) body.update = args.update;
    if (args.properties) body.properties = args.properties;
    if (args.historyMetadata) body.historyMetadata = args.historyMetadata;
    const query = args.updateHistory !== undefined ? `?updateHistory=${args.updateHistory}` : '';
    return success('jira_create_issue', await client.request('POST', `/issue${query}`, body));
  }));

  server.registerTool('jira_update_issue', {
    title: 'Update Issue',
    description: 'Update Jira issue fields. Use jira_get_edit_meta to list the editable fields of the issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      fields: z.record(z.string(), z.unknown()).describe('Jira fields object'),
      notifyUsers: z.boolean().optional().describe('Send notifications (API default true; suppressing requires admin/project-admin permission)'),
      update: z.record(z.string(), z.unknown()).optional().describe('Field update operations (advanced)'),
      properties: z.array(z.record(z.string(), z.unknown())).optional().describe('Issue properties [{key,value}]'),
      historyMetadata: z.record(z.string(), z.unknown()).optional().describe('History metadata (advanced)'),
    }),
    annotations,
  }, withTool('jira_update_issue', async (args) => {
    await guarded(args.issueKey, 'update');
    const query = args.notifyUsers !== undefined ? `?notifyUsers=${args.notifyUsers}` : '';
    const body = { fields: args.fields };
    if (args.update) body.update = args.update;
    if (args.properties) body.properties = args.properties;
    if (args.historyMetadata) body.historyMetadata = args.historyMetadata;
    return success('jira_update_issue', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}${query}`, body));
  }));

  server.registerTool('jira_clone_issue', {
    title: 'Clone Issue',
    description: 'Clone a Jira issue into a target project (title/labels/description/priority/assignee/components/versions default to the source).',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Source issue key'),
      projectKey: z.string().describe('Target project key'),
      summary: z.string().optional().describe('New summary; defaults to the source summary'),
      labels: z.array(z.string()).optional().describe('Labels; defaults to the source labels'),
      description: z.string().optional().describe('Description override'),
      priority: z.string().optional().describe('Priority override'),
      assignee: z.string().optional().describe('Assignee override'),
      components: z.array(z.string()).optional().describe('Component override'),
      fixVersions: z.array(z.string()).optional().describe('Fix version override'),
      customFields: z.record(z.string(), z.unknown()).optional().describe('Custom fields by ID'),
    }),
    annotations,
  }, withTool('jira_clone_issue', async (args) => {
    const source = await guarded(args.issueKey, 'clone');
    const summary = args.summary || source.fields.summary;
    const labels = args.labels ?? source.fields.labels ?? [];
    const fields = { project: { key: args.projectKey }, issuetype: { id: source.fields.issuetype?.id }, summary, labels };
    const description = args.description ?? source.fields.description;
    if (description) fields.description = description;
    const priority = args.priority ?? source.fields.priority?.name;
    if (priority) fields.priority = { name: priority };
    const assignee = args.assignee ?? source.fields.assignee?.name;
    if (assignee) fields.assignee = { name: assignee };
    const components = args.components ?? source.fields.components?.map((component) => component.name);
    if (components?.length) fields.components = components.map((name) => ({ name }));
    const fixVersions = args.fixVersions ?? source.fields.fixVersions?.map((version) => version.name);
    if (fixVersions?.length) fields.fixVersions = fixVersions.map((name) => ({ name }));
    if (args.customFields) Object.assign(fields, args.customFields);
    return success('jira_clone_issue', await client.request('POST', '/issue', { fields }));
  }));

  server.registerTool('jira_update_issue_assignee', {
    title: 'Update Issue Assignee',
    description: 'Change the assignee of an issue.',
    inputSchema: z.strictObject({ issueKey: z.string().describe('Issue key'), username: z.string().describe('Username') }),
    annotations,
  }, withTool('jira_update_issue_assignee', async (args) => {
    await guarded(args.issueKey, 'update');
    return success('jira_update_issue_assignee', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}/assignee`, { name: args.username }));
  }));

  server.registerTool('jira_update_issue_labels', {
    title: 'Update Issue Labels',
    description: 'Replace the labels of an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      labels: z.array(z.string()).describe('New labels (replaces existing)'),
      notifyUsers: z.boolean().optional().describe('Send notifications (API default true; suppressing requires admin/project-admin permission)'),
    }),
    annotations,
  }, withTool('jira_update_issue_labels', async (args) => {
    await guarded(args.issueKey, 'update');
    const query = args.notifyUsers !== undefined ? `?notifyUsers=${args.notifyUsers}` : '';
    return success('jira_update_issue_labels', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}${query}`, { fields: { labels: args.labels } }));
  }));

  server.registerTool('jira_update_issue_priority', {
    title: 'Update Issue Priority',
    description: 'Change the priority of an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      priority: z.string().describe('Priority name'),
      notifyUsers: z.boolean().optional().describe('Send notifications (API default true; suppressing requires admin/project-admin permission)'),
    }),
    annotations,
  }, withTool('jira_update_issue_priority', async (args) => {
    await guarded(args.issueKey, 'update');
    const query = args.notifyUsers !== undefined ? `?notifyUsers=${args.notifyUsers}` : '';
    return success('jira_update_issue_priority', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}${query}`, { fields: { priority: { name: args.priority } } }));
  }));

  server.registerTool('jira_update_issue_components', {
    title: 'Update Issue Components',
    description: 'Replace the components of an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      components: z.array(z.string()).describe('Component names (replaces existing)'),
      notifyUsers: z.boolean().optional().describe('Send notifications (API default true; suppressing requires admin/project-admin permission)'),
    }),
    annotations,
  }, withTool('jira_update_issue_components', async (args) => {
    await guarded(args.issueKey, 'update');
    const query = args.notifyUsers !== undefined ? `?notifyUsers=${args.notifyUsers}` : '';
    return success('jira_update_issue_components', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}${query}`, { fields: { components: args.components.map((name) => ({ name })) } }));
  }));

  server.registerTool('jira_add_comment', {
    title: 'Add Comment',
    description: 'Add a comment to an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      body: z.string().describe('Comment text'),
      visibility: z.record(z.string(), z.unknown()).optional().describe('e.g. {"type":"group","value":"jira-users"}'),
      expand: z.string().optional().describe('e.g. renderedBody'),
    }),
    annotations,
  }, withTool('jira_add_comment', async (args) => {
    await guarded(args.issueKey, 'comment');
    const query = args.expand ? `?expand=${encodeURIComponent(args.expand)}` : '';
    const body = { body: args.body };
    if (args.visibility) body.visibility = args.visibility;
    return success('jira_add_comment', await client.request('POST', `/issue/${pathSegment(args.issueKey)}/comment${query}`, body));
  }));

  server.registerTool('jira_edit_comment', {
    title: 'Edit Comment',
    description: 'Edit an issue comment.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      commentId: z.string().describe('Comment ID'),
      body: z.string().describe('Comment text'),
      visibility: z.record(z.string(), z.unknown()).optional().describe('e.g. {"type":"group","value":"jira-users"}'),
      expand: z.string().optional().describe('e.g. renderedBody'),
    }),
    annotations,
  }, withTool('jira_edit_comment', async (args) => {
    await guarded(args.issueKey, 'comment');
    const query = args.expand ? `?expand=${encodeURIComponent(args.expand)}` : '';
    const body = { body: args.body };
    if (args.visibility) body.visibility = args.visibility;
    return success('jira_edit_comment', await client.request('PUT', `/issue/${pathSegment(args.issueKey)}/comment/${pathSegment(args.commentId)}${query}`, body));
  }));

  server.registerTool('jira_upload_attachment', {
    title: 'Upload Attachment',
    description: 'Upload an attachment (base64 content) to an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      filename: z.string().describe('Filename'),
      contentBase64: z.string().describe('Base64 content'),
    }),
    annotations,
  }, withTool('jira_upload_attachment', async (args) => {
    await guarded(args.issueKey, 'attachment');
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(args.contentBase64, 'base64')]), args.filename);
    return success('jira_upload_attachment', await client.requestMultipart('POST', `/issue/${pathSegment(args.issueKey)}/attachments`, form));
  }));

  server.registerTool('jira_add_worklog', {
    title: 'Add Worklog',
    description: 'Add a worklog entry to an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      timeSpent: z.string().describe('Time spent, e.g. 1h 30m'),
      timeSpentSeconds: z.number().int().min(1).optional().describe('Time spent in seconds (alternative to timeSpent)'),
      comment: z.string().optional(),
      started: z.string().optional().describe('Start time, e.g. 2026-10-13T10:00:00.000+0800'),
      adjustEstimate: z.string().optional().describe('auto, leave, manual, new or reduce'),
      newEstimate: z.string().optional().describe('Used with adjustEstimate=manual'),
      reduceBy: z.string().optional().describe('Used with adjustEstimate=reduce'),
      visibility: z.record(z.string(), z.unknown()).optional().describe('e.g. {"type":"group","value":"jira-users"}'),
    }),
    annotations,
  }, withTool('jira_add_worklog', async (args) => {
    await guarded(args.issueKey, 'worklog');
    const params = new URLSearchParams();
    if (args.adjustEstimate) params.set('adjustEstimate', args.adjustEstimate);
    if (args.newEstimate) params.set('newEstimate', args.newEstimate);
    if (args.reduceBy) params.set('reduceBy', args.reduceBy);
    const query = params.toString();
    const body = { timeSpent: args.timeSpent };
    if (args.timeSpentSeconds !== undefined) body.timeSpentSeconds = args.timeSpentSeconds;
    if (args.comment) body.comment = args.comment;
    if (args.started) body.started = args.started;
    if (args.visibility) body.visibility = args.visibility;
    return success('jira_add_worklog', await client.request('POST', `/issue/${pathSegment(args.issueKey)}/worklog${query ? `?${query}` : ''}`, body));
  }));

  server.registerTool('jira_link_issues', {
    title: 'Link Issues',
    description: 'Create a link between two issues.',
    inputSchema: z.strictObject({
      inwardIssue: z.string().describe('Inward issue key'),
      outwardIssue: z.string().describe('Outward issue key'),
      linkType: z.string().describe('Link type name, e.g. Blocks'),
      comment: z.string().optional().describe('Comment to add with the link'),
    }),
    annotations,
  }, withTool('jira_link_issues', async (args) => {
    await guarded(args.inwardIssue, 'link');
    await guarded(args.outwardIssue, 'link');
    const body = { type: { name: args.linkType }, inwardIssue: { key: args.inwardIssue }, outwardIssue: { key: args.outwardIssue } };
    if (args.comment) body.comment = { body: args.comment };
    return success('jira_link_issues', await client.request('POST', '/issueLink', body));
  }));

  server.registerTool('jira_create_issue_link', {
    title: 'Create Remote Issue Link',
    description: 'Create a remote issue link (remotelink) on an issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      url: z.string().describe('Remote URL'),
      title: z.string().optional().describe('Link title; defaults to the URL'),
      icon: z.string().optional().describe('Icon URL (url16x16)'),
      statusResolved: z.boolean().optional().describe('Remote link resolved status'),
      globalId: z.string().optional(),
      relationship: z.string().optional().describe('e.g. causes'),
      application: z.record(z.string(), z.unknown()).optional().describe('Application {name,type} (advanced)'),
    }),
    annotations,
  }, withTool('jira_create_issue_link', async (args) => {
    await guarded(args.issueKey, 'link');
    const object = { url: args.url, title: args.title || args.url };
    if (args.icon) object.icon = { url16x16: args.icon };
    if (args.statusResolved !== undefined) object.status = { resolved: args.statusResolved };
    const body = { object };
    if (args.globalId) body.globalId = args.globalId;
    if (args.relationship) body.relationship = args.relationship;
    if (args.application) body.application = args.application;
    return success('jira_create_issue_link', await client.request('POST', `/issue/${pathSegment(args.issueKey)}/remotelink`, body));
  }));

  server.registerTool('jira_transition_issue', {
    title: 'Transition Issue',
    description: 'Transition an issue to another status.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      transitionId: z.string().describe('Transition ID (query with jira_get_issue_transitions)'),
      fields: z.record(z.string(), z.unknown()).optional().describe('Fields required by the transition screen'),
      update: z.record(z.string(), z.unknown()).optional().describe('Field update operations (advanced)'),
      properties: z.array(z.record(z.string(), z.unknown())).optional().describe('Issue properties [{key,value}]'),
      historyMetadata: z.record(z.string(), z.unknown()).optional().describe('History metadata (advanced)'),
    }),
    annotations,
  }, withTool('jira_transition_issue', async (args) => {
    await guarded(args.issueKey, 'transition');
    const body = { transition: { id: String(args.transitionId) } };
    if (args.fields) body.fields = args.fields;
    if (args.update) body.update = args.update;
    if (args.properties) body.properties = args.properties;
    if (args.historyMetadata) body.historyMetadata = args.historyMetadata;
    return success('jira_transition_issue', await client.request('POST', `/issue/${pathSegment(args.issueKey)}/transitions`, body));
  }));

  server.registerTool('jira_bulk_update_issues', {
    title: 'Bulk Update Issues',
    description: 'Update multiple issues with the same fields (all targets are preflighted before any write).',
    inputSchema: z.strictObject({
      issueKeys: z.array(z.string()).max(50).describe('Issue keys (max 50)'),
      fields: z.record(z.string(), z.unknown()).describe('Fields to apply to every issue'),
    }),
    annotations,
  }, withTool('jira_bulk_update_issues', async (args) => {
    guard.assertEnabled('bulk');
    await Promise.all(args.issueKeys.map((key) => guarded(key, 'bulk')));
    const data = await Promise.all(args.issueKeys.map((key) => client.request('PUT', `/issue/${pathSegment(key)}`, { fields: args.fields })));
    return success('jira_bulk_update_issues', data);
  }));

  server.registerTool('jira_bulk_transition_issues', {
    title: 'Bulk Transition Issues',
    description: 'Transition multiple issues (all targets are preflighted before any write).',
    inputSchema: z.strictObject({
      issueKeys: z.array(z.string()).max(50).describe('Issue keys (max 50)'),
      transitionId: z.string().describe('Transition ID'),
      fields: z.record(z.string(), z.unknown()).optional().describe('Fields required by the transition screen'),
      update: z.record(z.string(), z.unknown()).optional().describe('Field update operations (advanced)'),
      properties: z.array(z.record(z.string(), z.unknown())).optional().describe('Issue properties [{key,value}]'),
      historyMetadata: z.record(z.string(), z.unknown()).optional().describe('History metadata (advanced)'),
    }),
    annotations,
  }, withTool('jira_bulk_transition_issues', async (args) => {
    guard.assertEnabled('bulk');
    await Promise.all(args.issueKeys.map((key) => guarded(key, 'bulk')));
    const body = { transition: { id: String(args.transitionId) } };
    if (args.fields) body.fields = args.fields;
    if (args.update) body.update = args.update;
    if (args.properties) body.properties = args.properties;
    if (args.historyMetadata) body.historyMetadata = args.historyMetadata;
    const data = await Promise.all(args.issueKeys.map((key) => client.request('POST', `/issue/${pathSegment(key)}/transitions`, body)));
    return success('jira_bulk_transition_issues', data);
  }));
}
