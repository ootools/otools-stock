# 股票工作台 · OTools Stock Desk

独立 OTools 股票插件，**默认 Panel 模式**。以 A 股为主，支持港股、美股公开行情与私人持股账本。

## 功能

- **自选盯盘**：名称/代码/拼音搜索、在线搜索、自选分组、置顶、组内移动、筛选、现价/涨跌幅/成交额排序。
- **行情看板**：上证指数、深证成指、创业板指、恒生指数；价格、开高低、昨收、量额、换手率、PE、总市值，可用时展示五档。
- **图表**：真实分时及日/周/月 K 线、成交量、均价、MA5/10/20；悬停或左右键查看。不生成假行情。
- **持股**：录入期初持股、买入、卖出，编辑/删除交易；自动计算加权成本、市值、浮盈、已实现盈亏及行情日盈亏。
- **价格提醒**：价格/涨跌幅上下阈值、冷却、再次跨阈值重置、最近 200 条触发记录；可主动启用系统通知及声音。
- **数据备份**：本地存储；JSON 全量导入导出、持股/自选 CSV；导入前验证及确认，不合法导入整体拒绝。
- **显示**：深色/浅色/跟随系统，红涨绿跌或绿涨红跌，宽 Panel 双栏、窄 Panel 堆叠，`⌘/Ctrl K` 搜索。

## 安装

六平台正式构建产物（按系统和架构选择）：

```text
dist-pack/release/otools-stock-0.1.0-{windows,windows-arm,macos,macos-intel,linux,linux-arm}.oplg
```

在 OTools 的插件管理/插件市场中使用「本地安装」，选择上述 `.oplg` 文件。
清单 `openMode: "panel"`，入口 `dist/index.html`，无原生动态库。要求宿主支持
`otools_host_http_send`、插件本地状态与 SDK 桥；manifest 最低版本标记为 `0.9.1`，建议使用当前工作区宿主版本。

源代码开发清单中有 `devUrl`/`quickDev`，正式 `.oplg` 会去除它们。无需 API Key。
独立仓库：`ootools/otools-stock`，父仓库子模块路径：`xyito/otools/otools-stock`。六包发布与完整性流程见 [`docs/RELEASE.md`](docs/RELEASE.md)。真实运行中的 OTools Panel/六系统 UI 尚未实机验收。

## 开发与验收

要求 Node >=22、pnpm 11.25.0（packageManager 已固定；也可使用 Corepack）。

```bash
pnpm install --frozen-lockfile
pnpm dev                   # 127.0.0.1:6552；端口冲突请加 --port
pnpm test                  # domain/component + Node package/production-DOM tests
pnpm typecheck
pnpm build                 # Vite → dist/
pnpm run pack              # 六个 .oplg → dist-pack/release/；注意不是 pnpm pack（那是 pnpm 内置 .tgz 命令）
pnpm verify                # 六包完整性 / ZIP CRC / SHA256 / 内外清单
pnpm preview               # 带固定目标代理的 production preview
pnpm smoke:market          # 请求真实数据源（需要网络）
OTOOLS_LIVE_DOM=1 node --test tests/production-dom.test.mjs
```

`pnpm pack:plugin` 也是六平台打包别名，`pnpm pack:universal` 保留通用本地包构建。六包共享同一份纯前端资源，没有原生库。预览端口可使用 `pnpm preview --port 6553`。
仅安装 esbuild 所需的构建脚本在 `pnpm-workspace.yaml` 中获准。

开发/预览绑定 **127.0.0.1**，固定代理到腾讯行情域名；不接受任意 URL/远程 Host/跨源请求。
安装到 OTools 后由宿主 HTTP 能力请求，不依赖本地代理服务或 Node。

详见 [`docs/SPEC.md`](docs/SPEC.md) 和 [`docs/VERIFICATION.md`](docs/VERIFICATION.md)。

## 证券代码与数据来源

| 市场 | 输入例子 | 内部代码 | 账本币种 |
|---|---|---|---|
| A 股 | `600519`、`sh600519`、`SH.600519` | `sh600519` | CNY |
| 深圳 | `000001`、`300750` | `sz000001`、`sz300750` | CNY |
| 北交所 | `920001`、`bj920001` | `bj920001` | CNY |
| 港股 | `00700`、`hk700`、`700.HK` | `hk00700` | HKD |
| 美股 | `AAPL`、`usAAPL`、`BRK.B` | `usAAPL`、`usBRK.B` | USD |

大陆 B 股（900xxx/200xxx）、特殊结算币种的证券、衍生品及交易执行不在首版范围。
港股按普通 HKD 股票估值；请勿将人民币交易柜台当作港币持股记账。

接口：腾讯财经公开行情（`qt.gtimg.cn`）、搜索（`smartbox.gtimg.cn`）、分时与 K 线
（`web.ifzq.gtimg.cn`）。以服务器实际返回值为准，无登录、无数据库上传、无持仓上传。
这些公开端点不是带 SLA/授权合同的数据服务；可能变更、限流、延时、中断，商业使用/再分发前需自行确认许可。
美国分钟数据可能仅返回收盘点；港股 K 线未返回前复权时标注「未复权」。
股数与成交额已规范成该市场原单位，A 股「手」换成股，「万元」换成人民币元。

每个行情展示交易所时间及状态：`行情已更新`、`快照/非实时`、`缓存`、`更新失败/旧行情`或`暂无行情`。
新鲜度门槛为 A 股 5 分钟，港美股 30 分钟；这只是插件的提醒保护门槛，不代表交易级实时性。
大陆/香港采用 UTC+8，美股采用纽约当地时区并考虑 DST，不按用户机器的时区猜测。

### 公开 K 线 API

已接入免 Key 的公开端点，日/周/月 K 线可在股票详情里直接切换。
接口地址、curl 示例、OHLC 字段顺序、复权回退和港美股差异见 [`docs/PUBLIC_MARKET_API.md`](docs/PUBLIC_MARKET_API.md)。
`pnpm smoke:market` 会实测 A/港/美三个市场 × 日/周/月共 9 组历史，并校验真实蜡烛数据。

## 持股与盈亏口径

- **期初持股**：当天开盘前已有存量，每只股票最多一笔，在买卖之前；价格是每股期初成本，费用纳入总成本。
- **买入**：支出含费用，和既有成本合并；加权平均。
- **卖出**：按当时平均成本分摊卖出成本，净收入扣除费用。超卖或造成历史超卖的修改/删除被原子拒绝。
- **浮盈**：当前持股市值减剩余成本。无行情时为 `—`，不拿成本价替代行情。
- **行情日盈亏**：`现有市值 − 昨收 × 隔夜股数 − 当日买入支出 + 当日卖出净收入`。
  以行情返回的交易日为准，含当日费用；行情早于账本中的后续交易时不计算错误市值/日盈亏。
- **币种**：人民币、港币、美元分开汇总，不自动填写汇率；缺价币种明确显示已知小计和缺失数。
- **清仓**：保留全部交易及已实现盈亏，「已清仓」开关可查看；近期卖出证券仍获取行情用于卖出日盈亏。

数量最多四位小数，价费最多六位；计算中间值使用 BigInt 定点成本，完全卖出时释放所有成本，避免浮点残余。
首版不自动处理股息、拆股、配股、转托管、跨币种成本或券商对账；这类情况需维护期初数据或后续增加明确账本事件。

## 提醒与持久化

触发后必须先退出阈值区间，再进入且冷却完成才再报。同一交易所时间不重复触发；旧缓存、未来时间、
无时间和超期行情不参与提醒。提醒数据与最近 200 条记录本地保存。

关闭插件、暂停刷新、隐藏节能或网络中断期间不保证提醒。没有云端、后台进程或券商服务。
系统通知需明确授予浏览器权限；音频上下文可能重启后被浏览器暂停，需要重新主动点击启用。

OTools 环境使用 `getPluginLocalState/savePluginLocalState('otools-stock', ...)`。
浏览器预览使用 `localStorage['otools-stock:state:v1']`，两者独立，不自动互相迁移。
存储损坏会保留原始记录并锁定写入；可通过设置导入已校验 JSON 备份恢复。
存储失败会显示「未保存」并保留内存数据，可导出或重试。JSON 上限 **2 MiB**，记录/证券/分组也有独立上限。
持股和备注属于敏感信息，导出后请妥善保存。CSV 有 UTF-8 BOM 和公式前缀转义。

## 发布（仅在用户明确授权后）

```bash
pnpm typecheck && pnpm test && pnpm build
pnpm run pack && pnpm verify
# 先创建对应版本 GitHub Release 并附上 .oplg，再运行 publish-market.mjs。
# PAT 仅从本机配置读取到环境变量；不得写入文件、提交或日志。
```

发布前校验六个附件，使用 `PLATFORM_PACKAGES=1`，市场按 `packageMode=1` 指向六包。发布脚本接受 `plugin-otools-stock-v0.1.0` tag；logo 使用同一 tag 下的 immutable raw 文件。
遵守工作区 AGENTS.md：market PAT 仅在进程环境中使用，`::add-mask::` 行需要在进会话/CI 日志前脱敏。

第三方许可证见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
