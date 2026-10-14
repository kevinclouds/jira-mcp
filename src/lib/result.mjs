export function normalizePage(input = {}) {
  return {
    startAt: Math.max(0, Number.isInteger(input.startAt) ? input.startAt : 0),
    maxResults: Math.min(1000, Math.max(1, Number.isInteger(input.maxResults) ? input.maxResults : 50)),
  };
}

export function paginationFrom(data) {
  if (data && typeof data === 'object' && Number.isInteger(data.startAt) && Number.isInteger(data.maxResults)) {
    return {
      startAt: data.startAt,
      maxResults: data.maxResults,
      total: data.total ?? data.values?.length ?? data.issues?.length ?? 0,
    };
  }
  return undefined;
}

export function toolOk(data, summary, pagination) {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: pagination ? { data, pagination } : { data },
  };
}

const suggestions = {
  JIRA_AUTHENTICATION_FAILED: 'Check the Jira URL, username, password, or session login.',
  JIRA_PERMISSION_DENIED: 'Ask a Jira administrator or project administrator for the required permission.',
  JIRA_RESOURCE_NOT_FOUND: 'Check the resource key and whether the account can browse it.',
  JIRA_NETWORK_ERROR: 'Check the Jira URL and network connection.',
};

export function toolFail(error) {
  const value = {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Unexpected error',
    suggestion: suggestions[error.code],
  };
  return {
    isError: true,
    content: [{ type: 'text', text: `${value.code}: ${value.message}` }],
    structuredContent: { error: value },
  };
}
