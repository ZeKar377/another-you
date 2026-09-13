# Codex / 终端连接阿里云服务器

`server-connect.sh` 封装本项目一直使用的阿里云 Workbench CLI 连接方式。在本机运行，由本机 Codex 或终端操作远程 ECS；不需要在服务器上额外安装 Codex。

默认目标：杭州 `i-bp1d8o6u6htjltdnfxxh`，登录用户 `root`。公网网站为 `http://115.29.221.43/`。应用目录 `/opt/another-you`，数据目录 `/var/lib/another-you`，服务 `another-you.service`。不要向日志输出 `/etc/another-you.env` 等凭据文件。

## 本机直接使用

```bash
# 检查连接、服务状态和 HTTP（只读）
bash server-connect.sh status

# 进入服务器终端
bash server-connect.sh

# Codex 常用：执行远程命令，stdout/stderr 直接输出，并返回远程退出码
bash server-connect.sh exec 'cd /opt/another-you && pwd'

# 执行多行脚本；引号保证 $、反引号等不会在本机展开
bash server-connect.sh exec-file - <<'REMOTE'
set -e
cd /opt/another-you
node --version
systemctl is-active another-you.service
REMOTE

# 文件传输；仅在明确需要覆盖时添加 --force
bash server-connect.sh upload ./release.tgz /tmp/release.tgz
bash server-connect.sh download /tmp/report.txt ./report.txt
```

交互终端输入 `/exit` 或 Ctrl+D 关闭会话；输入 `/detach` 保留会话，之后再次连接会自动接回。`connect --new` 强制创建新终端。每次 `exec` 都是独立 shell，前一次的 `cd` 和环境变量不会保留。远程脚本按服务器 shell 执行。

## 换一台电脑

需要 Bash、Workbench CLI；`status`、`exec`、`exec-file` 另需 Python 3。当前电脑已具备。

从阿里云官方地址下载安装器，再执行：

```bash
curl -fsSL https://workbench-cli.oss-cn-hangzhou.aliyuncs.com/install.sh -o /tmp/aliyun-workbench-install.sh
bash /tmp/aliyun-workbench-install.sh
bash server-connect.sh config
bash server-connect.sh status
```

`config` 通过官方交互流程配置阿里云凭据；已有配置时会显示当前默认值，请仅在自己的终端操作。Workbench 将配置保存在 `~/.workbench/config.json`，权限为 0600。压缩包不包含该文件或任何密钥。新机器需要自己的有效凭据和相应 ECS/Workbench 权限。

可通过环境变量改用另一实例或本机已有 profile：

```bash
WORKBENCH_PROFILE=my-profile bash server-connect.sh status
ECS_INSTANCE_ID=i-your-instance ECS_REGION=cn-hangzhou bash server-connect.sh connect
ECS_TIMEOUT=120 bash server-connect.sh exec 'your-command'
```

`ECS_USER` 默认 root；`WORKBENCH_BIN` 可指定 CLI 可执行文件路径。脚本会优先发现 PATH 中的 Workbench，再检查 `~/.local/bin/workbench`。

## 给其他 Codex 任务的提示

将脚本和本文复制到目标工作目录后，告诉 Codex：

> 使用 server-connect.sh status 检查连接，使用 exec 或 exec-file 执行服务器命令，upload/download 传输文件。沿用本机 Workbench 凭据，不输出密钥。不需要重复安装 CLI 或创建 SSH 密钥。
