import * as z from 'zod';
import { pathSegment, makeGuarded, success, withTool } from './helpers.mjs';

const annotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

export function registerDeleteTools(server, { client, guard }) {
  const guarded = makeGuarded(client, guard);

  server.registerTool('jira_delete_issue', {
    title: 'Delete Issue',
    description: 'Delete a Jira issue.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      deleteSubtasks: z.boolean().optional().describe('Delete subtasks together (required when the issue has subtasks)'),
    }),
    annotations,
  }, withTool('jira_delete_issue', async (args) => {
    await guarded(args.issueKey, 'delete');
    const query = args.deleteSubtasks !== undefined ? `?deleteSubtasks=${args.deleteSubtasks}` : '';
    return success('jira_delete_issue', await client.request('DELETE', `/issue/${pathSegment(args.issueKey)}${query}`));
  }));

  server.registerTool('jira_delete_comment', {
    title: 'Delete Comment',
    description: 'Delete an issue comment.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      commentId: z.string().describe('Comment ID'),
    }),
    annotations,
  }, withTool('jira_delete_comment', async (args) => {
    await guarded(args.issueKey, 'delete');
    return success('jira_delete_comment', await client.request('DELETE', `/issue/${pathSegment(args.issueKey)}/comment/${pathSegment(args.commentId)}`));
  }));

  server.registerTool('jira_delete_attachment', {
    title: 'Delete Attachment',
    description: 'Delete an issue attachment.',
    inputSchema: z.strictObject({
      issueKey: z.string().describe('Issue key'),
      attachmentId: z.string().describe('Attachment ID'),
    }),
    annotations,
  }, withTool('jira_delete_attachment', async (args) => {
    await guarded(args.issueKey, 'delete');
    return success('jira_delete_attachment', await client.request('DELETE', `/attachment/${pathSegment(args.attachmentId)}`));
  }));
}
