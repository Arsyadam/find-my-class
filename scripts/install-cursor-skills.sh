#!/usr/bin/env bash
# Install Karpathy + Apple HIG Cursor skills into the local user Cursor directory.
# Run on your machine (not a disposable Cloud Agent VM) so every project can load them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
CURSOR_HOME="${CURSOR_HOME:-${HOME}/.cursor}"

RULE_SRC="${REPO_ROOT}/.cursor/rules/karpathy-guidelines.mdc"
KARPATHY_SRC="${REPO_ROOT}/.cursor/skills/karpathy-guidelines"
APPLE_SRC="${REPO_ROOT}/.cursor/skills/apple-human-interface-skills"

if [[ ! -f "${RULE_SRC}" ]]; then
  echo "Missing ${RULE_SRC}" >&2
  exit 1
fi
if [[ ! -d "${KARPATHY_SRC}" ]]; then
  echo "Missing ${KARPATHY_SRC}" >&2
  exit 1
fi
if [[ ! -d "${APPLE_SRC}" ]]; then
  echo "Missing ${APPLE_SRC}" >&2
  exit 1
fi

mkdir -p "${CURSOR_HOME}/rules" "${CURSOR_HOME}/skills"

cp "${RULE_SRC}" "${CURSOR_HOME}/rules/karpathy-guidelines.mdc"
rm -rf "${CURSOR_HOME}/skills/karpathy-guidelines"
cp -R "${KARPATHY_SRC}" "${CURSOR_HOME}/skills/karpathy-guidelines"
rm -rf "${CURSOR_HOME}/skills/apple-human-interface-skills"
cp -R "${APPLE_SRC}" "${CURSOR_HOME}/skills/apple-human-interface-skills"

echo "Installed Cursor skills into ${CURSOR_HOME}"
echo "  rules/karpathy-guidelines.mdc"
echo "  skills/karpathy-guidelines/"
echo "  skills/apple-human-interface-skills/"
echo "Reload Cursor to pick up the new skills."
