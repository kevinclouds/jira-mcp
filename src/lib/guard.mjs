export class WriteGuard {
  constructor(config) {
    this.config = config;
  }

  assertEnabled(operation) {
    if (!this.config.allowWrite) throw new Error('Write operations are disabled. Set JIRA_ALLOW_WRITE=true.');
    if (operation === 'delete' && !this.config.allowDelete) throw new Error('Delete operations are disabled. Set JIRA_ALLOW_DELETE=true.');
  }
}
