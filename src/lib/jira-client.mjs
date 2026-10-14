export class JiraError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'JiraError';
    this.code = code;
    this.details = details;
  }
}

function joinUrl(base, path) {
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function errorFromResponse(status, payload) {
  const detail = Array.isArray(payload?.errorMessages) ? payload.errorMessages.join('; ') : '';
  if (status === 401) return new JiraError('JIRA_AUTHENTICATION_FAILED', detail || 'Jira rejected the credentials. Check JIRA_USERNAME and JIRA_PASSWORD.');
  if (status === 403) return new JiraError('JIRA_PERMISSION_DENIED', detail || 'The Jira account does not have permission for this operation.');
  if (status === 404) return new JiraError('JIRA_RESOURCE_NOT_FOUND', detail || 'The Jira resource was not found or is not visible to this account.');
  if (status === 400) return new JiraError('JIRA_INVALID_REQUEST', detail || 'Jira rejected the request parameters.');
  if (status >= 500) return new JiraError('JIRA_SERVER_ERROR', detail || `Jira returned HTTP ${status}.`);
  return new JiraError('JIRA_HTTP_ERROR', detail || `Jira returned HTTP ${status}.`);
}

export class JiraClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
    this.config = config;
    this.fetch = fetchImpl;
    this.sessionCookie = undefined;
  }

  apiUrl(path, base = '/rest/api/2') { return joinUrl(this.config.url, `${base}${path.startsWith('/') ? path : `/${path}`}`); }
  authUrl() { return joinUrl(this.config.url, '/rest/auth/1/session'); }

  async fetchRequest(url, options) {
    const signal = AbortSignal.timeout(this.config.timeoutMs ?? 15000);
    try {
      return await this.fetch(url, { ...options, signal });
    } catch {
      throw new JiraError('JIRA_NETWORK_ERROR', 'Unable to reach Jira. Check the URL and network connection.');
    }
  }

  async parseResponse(response) {
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) throw errorFromResponse(response.status, payload);
    return payload;
  }

  async request(method, path, body, retry = true, base = '/rest/api/2') {
    const headers = { Accept: 'application/json' };
    headers.Authorization = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.fetchRequest(this.apiUrl(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    try {
      return await this.parseResponse(response);
    } catch (error) {
      if (retry && error.code === 'JIRA_AUTHENTICATION_FAILED' && this.config.sessionFallback) {
        await this.createSession();
        return this.requestWithSession(method, path, body, base);
      }
      throw error;
    }
  }

  async createSession() {
    const response = await this.fetchRequest(this.authUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.config.username, password: this.config.password }),
    });
    const payload = await this.parseResponse(response);
    const session = payload?.session;
    if (!session?.name || !session?.value) throw new JiraError('JIRA_SESSION_INVALID', 'Jira returned no usable session cookie.');
    this.sessionCookie = `${session.name}=${session.value}`;
  }

  async requestWithSession(method, path, body) {
    if (!this.sessionCookie) await this.createSession();
    const headers = { Accept: 'application/json', Cookie: this.sessionCookie };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.fetchRequest(this.apiUrl(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return this.parseResponse(response);
  }

  async requestMultipart(method, path, formData) {
    const headers = { Accept: 'application/json', 'X-Atlassian-Token': 'no-check' };
    headers.Authorization = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
    const response = await this.fetchRequest(this.apiUrl(path), { method, headers, body: formData });
    return this.parseResponse(response);
  }

  async downloadContent(url) {
    if (new URL(url).origin !== new URL(this.config.url).origin) throw new JiraError('JIRA_INVALID_REQUEST', 'Attachment content URL is outside the configured Jira host.');
    const headers = { Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}` };
    const response = await this.fetchRequest(url, { method: 'GET', headers });
    if (!response.ok) throw errorFromResponse(response.status, {});
    return Buffer.from(await response.arrayBuffer()).toString('base64');
  }
}
