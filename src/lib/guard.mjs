export class WriteGuard {
  constructor(config) {
    this.config = config;
  }

  assertEnabled(operation) {
    if (!this.config.allowWrite) throw new Error('Write operations are disabled. Start the server with --allow-write.');
    if (operation === 'delete' && !this.config.allowDelete) throw new Error('Delete operations are disabled. Start the server with --allow-delete.');
  }
}
