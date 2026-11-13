# 六平台发布流程

仓库：`ootools/otools-stock`；父仓库子模块：`xyito/xyito` 的 `otools/otools-stock`。
首版 `0.1.0`，标签 `plugin-otools-stock-v0.1.0`。当前用户明确授权建仓、注册子模块和六包发布。

## 六种 .oplg

| 操作系统 | 架构 | 文件名 |
|---|---|---|
| Windows | x64 | `otools-stock-0.1.0-windows.oplg` |
| Windows | arm64 | `otools-stock-0.1.0-windows-arm.oplg` |
| macOS | Apple Silicon arm64 | `otools-stock-0.1.0-macos.oplg` |
| macOS | Intel x64 | `otools-stock-0.1.0-macos-intel.oplg` |
| Linux | x64 | `otools-stock-0.1.0-linux.oplg` |
| Linux | arm64 | `otools-stock-0.1.0-linux-arm.oplg` |

这是纯前端 OTools 插件，六包共享**同一份已验证的页面资源**，不包含原生库，不需要伪造交叉编译。
六个平台名及市场 URL 字段由 `scripts/platform-packages.mjs` 唯一定义。实际各操作系统 OTools UI 行为仍需人工验收，不能仅凭包校验声称六系统实机已测。

## 构建与完整性

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm smoke:market       # 可选真实公开数据源检查，常规 CI 不依赖外网
pnpm run pack           # 六包 → dist-pack/release/
pnpm verify            # 六包/CRC/SHA256/内外清单/源码资源/元信息完整性
```

`pnpm pack` 是 pnpm 的 .tgz 命令，不能替代 `pnpm run pack`。
单个包可用 `node scripts/pack-plugin.mjs --platform windows --arch arm64 --out dist-pack/windows-arm`。
兼容的通用本地包：`pnpm pack:universal`，不是六平台正式 release 的附件。

输出目录必须干净或只含相同版本目标文件；发现其他版本/变体 `.oplg` 会拒绝，避免混发。

## GitHub Release

只在用户明确授权后执行。先推送已验证的 `main`，再创建指向该提交的 immutable tag，随后上传六个 `.oplg` 和 `SHA256SUMS`、`plugin.json`、`logo.svg`、`meta.json`。
已有 tag 指向其他 commit 时停止，不能强制移动或覆盖附件。
下载公开 Release 附件核对摘要及 ZIP，再提交市场元数据。
CI `.github/workflows/build-plugin.yml` 只测试/打包，不自动发布、创建标签或使用市场凭证。

## 插件市场

确认六个附件都存在后，`PLATFORM_PACKAGES=1` 启用 `packageMode=1` 与六个 `packageUrl*`；不指向不存在的合包。
Logo 使用同一 tag 的 `raw.githubusercontent.com` SVG，不使用下载资产 URL。

本机 PAT 按工作区 AGENTS.md 读取到环境，**不得进入仓库、commit、GitHub Secrets 或日志**。示意：

```bash
# 必须关闭 shell tracing；输出在进入日志前去除 mask token 行。
AUTH_MODE=pat \
PLATFORM_PACKAGES=1 \
XYCLOUD_PAT="$(tr -d '[:space:]' < ../../config/ps-pro/pat.txt)" \
GITHUB_REPOSITORY=ootools/otools-stock \
RELEASE_VERSION=0.1.0 \
RELEASE_TAG=plugin-otools-stock-v0.1.0 \
node scripts/publish-market.mjs | sed '/^::add-mask::/d'
```

发布器只有得到 HTTP 成功且业务 `code=200` 时报告成功；发布后需读回平台下载链接。
父仓库只提交 `.gitmodules` 与该 gitlink，不能把并行改动的其他子模块带入。

## 当前验收限制

已验证真实接口/生产 DOM/交易账本/包完整性；当前连接没有真实浏览器，尚未做各平台实机 Panel 截图、系统通知、声音或下载 UI 测试。行情可能限流/延时，不是券商交易软件。

## v0.1.0 已完成发布验证（2026-11-13）

- GitHub 仓库已创建为公开仓库，main 已推送。
- Release `plugin-otools-stock-v0.1.0` 指向源代码提交 `3f4301c371360f51f46f4fe7d7d327c907b70530`，六个包均已上传，下载回本机逐字节对比通过。
- GitHub CI run `43376299983` 全部成功；源码导出独立目录安装/构建/测试通过。
- OTools 市场已返回成功，公开列表读回 `version=0.1.0`、`packageMode=1` 与全部六个链接均正确。
- 发布元信息与包摘要见 `artifacts/release-verification.json` 和 `.txt`；对应 Release 附件 `SHA256SUMS`。
- 标记的 source tag 不会因后续发布记录文档提交而移动。父仓库仍只提交该子模块及 `.gitmodules`。
- 本机 raw.githubusercontent.com 直连请求失败，已通过 GitHub contents API 核对 tag 下 SVG 存在；市场记录使用正确的原始 tag URL。尚未声称六系统实机 UI 验收通过。
