# 验证记录

日期：2026-11-13；开发于现有 `main`，未创建分支/worktree，未更改宿主或其他插件。

## 已实际执行

- 单元/组件测试：证券规范化、币种/指数/B股边界，成本/费用/部分清仓/小数股/行情日现金流，非法快照、字节上限、公式注入。
- 行情：GB18030 字节解码、A 股手/万元规范化、港美股原单位、纽约 DST、缺字段/非法时间/不执行外部 JS。
- 异步：刷新无重叠/退避/同步抛错，图表切换取消旧请求，不让旧请求污染恢复的备份。
- 提醒：新鲜度、上下阈值、重复时间、冷却/再武装、编辑/启用不遗忘已处理时间。
- 存储：加载损坏不覆盖、写入失败未保存、写入串行和组件卸载后的最终快照排空、导入设置与调度同步。
- UI：加股票、导航、期初持股、拒绝超卖、创建提醒、主题切换、对话框焦点/Escape；导入确认/取消/非法数据拒绝。
- 最终独立审查的 5 个问题全部补 RED→GREEN：迟到的初始加载不能覆盖已恢复账本、0% 提醒保持 0、切换交易股票清除旧价格、暂停后 UI 行情标识自动过期、卸载后迟到初始化不启动轮询。
- `vue-tsc --noEmit`。
- Vite production build。
- `.oplg`：SHA256、ZIP 条目/CRC、内外 plugin.json 一致、默认 panel、无开发开关/原生库、篡改后拒绝。
- 生产 bundle DOM 集成：jsdom 运行**最终构建代码**并注入宿主 HTTP/状态 API；行情加载、持股表单/费用、状态保存、导航通过，无 native plugin dispatch。
- 真实网络生产 DOM：最终 bundle 请求腾讯源，6 只自选显示及真实分时 SVG 数据路径通过。`OTOOLS_LIVE_DOM=1` 为 opt-in，常规测试不会依赖外网。
- 真实 HTTP smoke：A/港/美 quotes；AAPL 在线搜索；A 股日 K 121 点、港股分钟数据、美股历史日 K 120 点。
- 2026-11-13 补充公开 K 线合同和验证：`pnpm smoke:market` 覆盖 A/港/美日、周、月全部 9 种组合，每条验证真实日期、OHLC、高低关系和成交量，不再只数日 K 数组长度。A/港股日 K 121 点、周/月 120 点；美股三周期 120 点。
- 新增三市场三周期解析、港股未复权回退、UI 周期按钮切换、OHLC 烟测校验/坏数据拒绝测试。完整公开端点说明见 `PUBLIC_MARKET_API.md`，实测输出见 `artifacts/kline-market-smoke.txt`。
- 恒指日 K 有数据。美国分时可能只有一个收盘点，照实展示。
- `127.0.0.1:6552` production preview：HTML、指数 quotes、名字搜索、分时/美股历史接口均 HTTP 200。

具体最终测试数量、构建体积和 .oplg SHA256 在 `artifacts/verification.txt` 与 `dist-pack/release/SHA256SUMS`。

## 尚未验证，不冒充完成

- **没有可连接浏览器**：按 Browser 技能初始化；`getForUrl` 返回 “No browser is available”，官方 troubleshooting 后 `browsers.list()` 返回空数组。
- 因而未完成真实浏览器截图、宽/窄 Panel 视觉确认、实际浏览器通知/音频与下载确认。组件/jsdom 验证不是视觉 QA。
- 未在实际运行的 OTools Panel 安装/加载。SDK HTTP/storage/文件合同已用工作区官方代码核对和 production DOM 验证，但真实宿主冷启动仍需人工验收。
- **远程发布已验证**：GitHub 公开仓库/main 与版本 tag、六包上传后下载对比、GitHub CI、源码独立构建、市场 packageMode=1 六链接读回均通过。详情见 `RELEASE.md` 与 `artifacts/release-verification.txt`。

## 人工验收建议

1. OTools 本地安装 `dist-pack/release/` 中对应操作系统/架构的 `.oplg`，确认默认 Panel。
2. 在宽 Panel 及 400–560px 窄 Panel 检查指数、自选/详情堆叠、表格横向滚动、弹层焦点和按钮。
3. 搜索新股票，创建分组/置顶，日/周/月 K 与分时切换。
4. 录入 100 股期初、20 股买入、30 股卖出（含费用），核对成本/浮盈/行情日盈亏；试超卖拒绝。
5. 建立价位提醒，验证非实时数据不触发；用户授予系统通知、点击启用声音后实测。
6. 导出 JSON、再导入确认；非法 JSON 与超卖备份整体拒绝。重启确认账本保留。
7. 断网/数据源错误时看旧行情标识及未保存提示，不应出现随机或成本替代价格。
