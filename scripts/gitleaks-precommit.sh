#!/bin/sh
# Pre-commit gitleaks scan, invoked by lefthook.yml.
#
# Skips gracefully when the gitleaks binary isn't installed so devs
# without it aren't blocked. When gitleaks is present, exec'ing it makes
# the script's exit status match gitleaks's exit status — non-zero on
# findings, zero on a clean scan.
#
# Install hints: https://github.com/gitleaks/gitleaks

set -eu

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks not installed — skipping secret scan"
  echo "  install: https://github.com/gitleaks/gitleaks"
  exit 0
fi

exec gitleaks protect --staged --no-banner --redact
