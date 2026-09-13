#!/usr/bin/env bash
set -euo pipefail
umask 077
bundle="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -eq 0 || ( $# -eq 1 && "$1" == --prepare-only ) ]] || { echo 'Usage: bootstrap-mac.sh [--prepare-only]' >&2; exit 2; }
command -v python3 >/dev/null || { echo '请先安装 Python 3（例如 brew install python）。' >&2; exit 1; }
if [[ "${1:-}" != --prepare-only ]]; then
  command -v node >/dev/null && command -v npm >/dev/null || { echo '请先安装 Node.js 22.12+（例如 brew install node@22 并添加到 PATH）。' >&2; exit 1; }
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<12))process.exit(1)' || { echo '需要 Node.js >=22.12。' >&2; exit 1; }
fi
python3 - "$bundle" <<'PY'
import json, os, shutil, sys, tarfile, datetime
from pathlib import Path
bundle=Path(sys.argv[1]); project=bundle/'another-you'
secrets=bundle/'private'; config=secrets/'workbench-config.json'
if not project.is_dir() or not config.is_file():
    sys.exit('请先解压完整迁移包，再运行包根目录的 bootstrap-mac.sh。')
# Only extract the selected app environment and data; never restore into system /etc or /var.
with tarfile.open(secrets/'server-snapshot.tgz') as archive:
    env=archive.extractfile('etc/another-you.env')
    if env is None: sys.exit('Snapshot is missing the server environment.')
    local_env=project/'.env.migration'
    if not local_env.exists(): local_env.write_bytes(env.read())
    local_env.chmod(0o600)
    data=project/'data-migration'
    if not data.exists():
        stage=project/'.data-migration-restore'
        if stage.exists(): sys.exit('检测到上次未完成的数据恢复，请检查 .data-migration-restore 后重试。')
        stage.mkdir(mode=0o700)
        prefix='var/lib/another-you/'
        for member in archive.getmembers():
            if not member.name.startswith(prefix): continue
            relative=Path(member.name[len(prefix):])
            if relative.is_absolute() or '..' in relative.parts: sys.exit('Unsafe archive path.')
            target=stage/relative
            if member.isdir(): target.mkdir(parents=True, exist_ok=True, mode=0o700)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.extractfile(member) as src, target.open('wb') as dst: shutil.copyfileobj(src,dst)
                target.chmod(0o600)
            else: sys.exit('Unsupported archive member in data snapshot.')
        stage.rename(data)
incoming=json.loads(config.read_text())
profile=incoming['profiles'][incoming['current']]
destination=Path.home()/'.workbench'; destination.mkdir(mode=0o700,exist_ok=True)
target=destination/'config.json'
if target.exists():
    existing=json.loads(target.read_text())
    backup=destination/('config.before-another-you-'+datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')+'.json')
    shutil.copyfile(target,backup); backup.chmod(0o600)
else: existing={'profiles':{}}
alias='another-you-migration'
existing.setdefault('profiles',{})[alias]=profile
existing.setdefault('current',alias)
temporary=destination/'.config.migration.tmp'
temporary.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n'); temporary.chmod(0o600); temporary.replace(target)
label=project/'tools/.workbench-profile'; label.write_text(alias+'\n'); label.chmod(0o600)
print('凭据已导入专用 Workbench profile；既有配置已保留。')
print('本地数据副本已准备；重复运行不覆盖已有开发数据或本地环境文件。')
PY
if [[ "${1:-}" == --prepare-only ]]; then exit 0; fi
if ! command -v workbench >/dev/null && [[ ! -x "$HOME/.local/bin/workbench" ]]; then
  installer="$(mktemp -t workbench-install.XXXXXX)"
  trap 'rm -f "$installer"' EXIT
  curl --fail --silent --show-error --location --connect-timeout 15 --max-time 120 https://workbench-cli.oss-cn-hangzhou.aliyuncs.com/install.sh -o "$installer"
  bash "$installer"
fi
cd "$bundle/another-you"
npm ci
npm test
npm run build
printf '\n准备完成。启动：bash "%s/start-local.sh"\n' "$bundle"
printf '连接服务器：bash "%s/tools/server-connect.sh" status\n' "$bundle/another-you"
