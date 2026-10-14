#!/bin/sh
set -eu

PATTERN="${RELEASE_FORBIDDEN_REGEX:-}"
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.log$)'; then
    echo 'Environment files or logs are tracked.' >&2
    exit 1
  fi
fi
if [ -n "$PATTERN" ] && command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git grep -n -i -E "$PATTERN" -- ':!scripts/release-check.sh'; then
    echo 'Forbidden release pattern found in tracked files.' >&2
    exit 1
  fi
elif [ -n "$PATTERN" ]; then
  if grep -rn -i -E "$PATTERN" . 2>/dev/null | grep -v -E '(^|/)\.git/|node_modules/|\.codex/|\.superpowers/|scripts/release-check\.sh'; then
    echo 'Forbidden release pattern found.' >&2
    exit 1
  fi
else
  echo 'No RELEASE_FORBIDDEN_REGEX supplied; pass company-specific patterns during release.'
fi

# npm audit requires the official registry (mirrors often lack the audit endpoint)
npm audit --audit-level=high --registry=https://registry.npmjs.org
echo 'Release checks passed. Enable GitHub Secret Scanning before publishing.'
