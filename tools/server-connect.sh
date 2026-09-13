#!/usr/bin/env bash
# Local Codex/terminal -> Alibaba Cloud ECS, using existing Workbench credentials.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: server-connect.sh [command]

  connect [--new]                Interactive shell (default)
  status                        Read-only server and app status
  exec 'remote shell command'    Run one remote command, propagate its exit code
  exec-file FILE|-               Run a local shell script remotely, or read stdin
  upload LOCAL REMOTE [--force]  Upload a file (overwrite only with --force)
  download REMOTE LOCAL [--force] Download a file
  config                        Configure credentials via Workbench's local prompt
  help                          Show this help

Optional environment overrides:
  ECS_INSTANCE_ID, ECS_REGION, ECS_USER, ECS_TIMEOUT, WORKBENCH_BIN, WORKBENCH_PROFILE
Credentials are read by Workbench; this script does not contain or copy them.
HELP
}

die() { printf '%s\n' "$*" >&2; exit 2; }
action="${1:-connect}"
if [[ $# -gt 0 ]]; then shift; fi
case "$action" in help|-h|--help) usage; exit 0;; esac

instance="${ECS_INSTANCE_ID:-i-bp1d8o6u6htjltdnfxxh}"
region="${ECS_REGION:-cn-hangzhou}"
remote_user="${ECS_USER:-root}"
timeout="${ECS_TIMEOUT:-60}"
[[ "$timeout" =~ ^[1-9][0-9]*$ ]] || die 'ECS_TIMEOUT must be a positive integer.'

wb="${WORKBENCH_BIN:-}"
if [[ -z "$wb" ]]; then
  wb="$(command -v workbench || true)"
  if [[ -z "$wb" && -x "$HOME/.local/bin/workbench" ]]; then wb="$HOME/.local/bin/workbench"; fi
fi
[[ -n "$wb" ]] || die 'Workbench CLI is missing. See README.md for installation.'
common=(--region "$region")
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${WORKBENCH_PROFILE:-}" && -f "$script_dir/.workbench-profile" ]]; then
  WORKBENCH_PROFILE="$(cat "$script_dir/.workbench-profile")"
fi
if [[ -n "${WORKBENCH_PROFILE:-}" ]]; then common+=(--profile "$WORKBENCH_PROFILE"); fi
target=(--instance-id "$instance" --user-name "$remote_user")

remote_exec() {
  command -v python3 >/dev/null || die 'python3 is required for exec/status output and exit-code handling.'
  # Pass remote text as one argument, never eval or expand it locally.
  "$wb" exec "${common[@]}" "${target[@]}" --timeout "$timeout" --command "$1" --output json |
    python3 -c '
import json, sys
try:
    result = json.load(sys.stdin)
except (ValueError, TypeError):
    sys.exit("Workbench did not return valid JSON; check the CLI error above.")
if not isinstance(result, dict) or not isinstance(result.get("exit_code"), int):
    sys.exit("Workbench did not return a completed remote command.")
sys.stdout.write(result.get("stdout", result.get("output", "")) or "")
sys.stderr.write(result.get("stderr", "") or "")
code = result["exit_code"]
sys.exit(code if 0 <= code <= 255 else 1)
'
}

case "$action" in
  connect)
    [[ $# -eq 0 || ( $# -eq 1 && "$1" == --new ) ]] || die 'Usage: server-connect.sh connect [--new]'
    exec "$wb" connect "${common[@]}" "${target[@]}" "$@"
    ;;
  config)
    [[ $# -eq 0 ]] || die 'Usage: server-connect.sh config'
    exec "$wb" config "${common[@]}"
    ;;
  status)
    [[ $# -eq 0 ]] || die 'Usage: server-connect.sh status'
    remote_exec 'set -e
printf "Server: "; hostname
printf "User: "; id -un
printf "Application: "; systemctl is-active another-you.service
printf "HTTP: "; curl --max-time 10 --fail --silent --show-error --output /dev/null --write-out "%{http_code} (%{time_total}s)\n" http://127.0.0.1/
df -h /opt/another-you'
    ;;
  exec)
    [[ $# -eq 1 ]] || die "Usage: server-connect.sh exec 'remote command'"
    remote_exec "$1"
    ;;
  exec-file)
    [[ $# -eq 1 ]] || die 'Usage: server-connect.sh exec-file FILE|-'
    if [[ "$1" == - ]]; then content="$(cat)"; else
      [[ -f "$1" && -r "$1" ]] || die 'Script file is not readable.'
      content="$(cat -- "$1")"
    fi
    [[ -n "$content" ]] || die 'Remote script is empty.'
    remote_exec "$content"
    ;;
  upload|download)
    [[ $# -eq 2 || ( $# -eq 3 && "$3" == --force ) ]] || die "Usage: server-connect.sh $action SOURCE DESTINATION [--force]"
    exec "$wb" "$action" "${common[@]}" "${target[@]}" "$@"
    ;;
  *) usage >&2; die "Unknown command: $action";;
esac
