#!/usr/bin/env bash
set -euo pipefail
bundle="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bundle/another-you"
[[ -f .env.migration && -d data-migration ]] || { echo '请先运行 bootstrap-mac.sh。' >&2; exit 1; }
# Environment variables take priority over Node --env-file values.
# Always use a local data directory and loopback listener, not production paths.
export HOST=127.0.0.1
export PORT="${PORT:-3000}"
export DATA_DIR="$PWD/data-migration"
export LLM_ENABLED="${LLM_ENABLED:-false}"
printf '本地服务：http://127.0.0.1:%s（LLM_ENABLED=%s）\n' "$PORT" "$LLM_ENABLED"
exec node --env-file=.env.migration server.mjs
