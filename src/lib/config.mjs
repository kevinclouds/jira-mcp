const VALUE_FLAGS = new Set(['--url', '--username', '--password']);

function readBooleanEnv(env, name) {
  return String(env[name] ?? '').toLowerCase() === 'true';
}

function readFlag(argv, name) {
  const exact = argv.indexOf(name);
  if (exact >= 0) return argv[exact + 1];
  const prefix = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefix ? prefix.slice(name.length + 1) : undefined;
}

export function loadConfig(argv = [], env = process.env) {
  const values = {
    url: readFlag(argv, '--url') ?? env.JIRA_URL,
    username: readFlag(argv, '--username') ?? env.JIRA_USERNAME,
    password: readFlag(argv, '--password') ?? env.JIRA_PASSWORD,
  };
  for (const flag of VALUE_FLAGS) {
    const index = argv.indexOf(flag);
    if (index >= 0 && argv[index + 1] === undefined) throw new Error(`${flag} requires a value`);
  }
  if (!values.url) throw new Error('JIRA_URL or --url is required');
  if (!values.username) throw new Error('JIRA_USERNAME or --username is required');
  if (!values.password) throw new Error('JIRA_PASSWORD or --password is required');
  return {
    ...values,
    allowWrite: readBooleanEnv(env, 'JIRA_ALLOW_WRITE'),
    allowDelete: readBooleanEnv(env, 'JIRA_ALLOW_DELETE'),
    sessionFallback: !argv.includes('--no-session-fallback'),
  };
}
