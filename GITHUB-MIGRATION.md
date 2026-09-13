# 从 GitHub 迁移到新 Mac

本公开仓库保存源码、网站资源、测试和连接工具，不包含真实凭据。完整迁移包（含原始图片音乐、阿里云凭据、GLM 配置及服务器数据）通过 age 加密，仅保存在独立的私有备份仓库 [another-you-migration](https://github.com/ZeKar377/another-you-migration/releases/tag/migration-20260913)；真实凭据不进入本仓库或 Git 历史。

## 只开发代码

克隆仓库后安装 Node.js >=22.12，依次运行 `npm ci`、`npm run build`、`npm test` 和 `npm start`。测试会校验构建产物的 CSP，因此先构建再测试。此模式没有真实凭据或线上历史数据；公开创建链接入口关闭。

## 完整恢复开发环境

1. 以拥有权限的账号登录，从上述私有备份仓库 Releases 下载 `.tar.gz.age` 和对应 `.sha256`。
2. 将原 Mac 上的 `another-you-github-decryption-key.txt` 通过 AirDrop 等私人渠道单独带到新 Mac。此文件不上传 GitHub，丢失后不能只凭 GitHub 附件解密。
3. 安装 age 并校验、解密：

```bash
brew install age
shasum -a 256 -c another-you-mac-migration-20260913-133434.tar.gz.age.sha256
age --decrypt -i /你的私钥文件路径/another-you-github-decryption-key.txt \
  -o another-you-migration.tar.gz \
  another-you-mac-migration-20260913-133434.tar.gz.age
tar -xzf another-you-migration.tar.gz
cd another-you-mac-migration-20260913-133434
bash bootstrap-mac.sh
bash start-local.sh
```

详细步骤见解压后的 `迁移说明.md`。默认启动只使用本地数据副本且关闭 GLM；真实 GLM 测试使用 `LLM_ENABLED=true bash start-local.sh`。完整包为 2026-09-13 快照，后续源码更新以仓库为准。

不要提交解密后的私钥、`private/`、`.env.migration` 或用户会话数据。

项目所有者另有一份本地《迁移说明-私密凭据版.md》，包含实际密钥和手动恢复配置；它位于项目之外，仅通过私人渠道传递，不上传 GitHub。普通使用者请配置自己的云服务及模型凭据。
