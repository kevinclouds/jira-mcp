import { paginationFrom, toolFail, toolOk } from '../lib/result.mjs';

export function pathSegment(value) {
  return encodeURIComponent(value);
}

export function withTool(name, handler) {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      if (error.code === 'JIRA_PERMISSION_DENIED') error.message = `${name}: ${error.message}`;
      return toolFail(error);
    }
  };
}

export function success(name, data, pagination) {
  return toolOk(data, `${name} completed successfully.`, pagination ?? paginationFrom(data));
}

export function makeGuarded(client, guard) {
  return async (issueKey, operation) => {
    guard.assertEnabled(operation);
    return client.request('GET', `/issue/${pathSegment(issueKey)}`);
  };
}
