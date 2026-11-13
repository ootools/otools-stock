# 公开行情 / K 线接口

本插件已接入腾讯财经公开可访问端点，无需填入 API Key 或登录账号。以下合同是 **2026-11-13 本机实测观察**，不是腾讯官方稳定 API/SLA 声明。第三方可能限流、更改格式或延时，商业使用和再分发需另行确认许可。

## 在插件里看 K 线

选择自选股票 → 右侧「股票详情」 → 点击 **日 K / 周 K / 月 K**。
宽 Panel 在右侧显示，窄 Panel 在自选列表下方显示。图上有蜡烛、成交量和 MA5/10/20；默认仍是「分时」。

## 1. A 股 / 港股历史 K 线

```text
GET https://web.ifzq.gtimg.cn/appstock/app/fqkline/get
param=<symbol>,<period>,<start>,<end>,<count>,<adjust>
```

直接可用例子：

```bash
# 贵州茅台，日 K，前复权，请求 120 条历史
curl --fail --get \
  -H 'Referer: https://stockapp.finance.qq.com/' \
  'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get' \
  --data-urlencode 'param=sh600519,day,,,120,qfq'

# 腾讯控股，周 K
curl --fail --get \
  -H 'Referer: https://stockapp.finance.qq.com/' \
  'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get' \
  --data-urlencode 'param=hk00700,week,,,120,qfq'
```

| 参数 | 插件使用值 / 说明 |
|---|---|
| `symbol` | `sh600519`、`sz300750`、`bj920001`、`hk00700` 等已规范证券代码 |
| `period` | `day` 日 K；`week` 周 K；`month` 月 K |
| `start` / `end` | 插件留空，使用接口默认最近历史窗口；不承诺未验证的日期范围行为 |
| `count` | 插件请求 `120`；服务可能附加尚未结束的最新周期，因此会返回 121 条 |
| `adjust` | 请求 `qfq`（前复权）；未返回复权字段时读取原始字段并标记「未复权」 |

港股实测返回 `day`、`week`、`month`，即使请求尾部写 `qfq` 也不能擅自宣称实际已复权。

## 2. 美股历史 K 线

```text
GET https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get
param=usAAPL.OQ,day,,,120,qfq
```

```bash
curl --fail --get \
  -H 'Referer: https://stockapp.finance.qq.com/' \
  'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get' \
  --data-urlencode 'param=usAAPL.OQ,month,,,120,qfq'
```

美股日/周/月历史需使用 `usfqkline` 端点，并可能需要交易场所后缀，如 `AAPL.OQ`。插件从报价字段中获取后缀，不固定猜测所有美股均为 `.OQ`。账本内部依然用 `usAAPL`，不会将 `.OQ` 当作另一只持股。

## 返回形状与蜡烛字段

成功通常有 `code: 0` 和 `data[symbol]`；程序仍要验证证券键、请求周期和每个数据点，不能只检查 HTTP 200。

```text
A 股 / 美股：data[symbol].qfqday | qfqweek | qfqmonth
未复权回退：data[symbol].day    | week    | month

每条蜡烛：
[日期, 开盘价, 收盘价, 最高价, 最低价, 成交量, ...]

注意这里是 open, close, high, low，而不是 open, high, low, close。
```

价格/成交量一般是字符串，插件会严格转成有限数字、验证真实日期和高低价范围。
A 股成交量“手”转换成股（×100）；港美股成交量保留股数原单位。图表去除坏行与重复日期，按日期排序，只画真实返回点。

## 3. 行情与分时

```text
# A / 港 / 美批量报价，返回文本编码 GB18030
https://qt.gtimg.cn/q=sh600519,hk00700,usAAPL

# 分时，JSON 文本
https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600519

# 美股分时使用 bare symbol，不添加历史专用 .OQ
https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=usAAPL

# 名称/拼音/代码搜索
https://smartbox.gtimg.cn/s3/?q=AAPL&t=all
```

分时 `data[symbol].data.data` 包含时间、价格、累计量/额等文本行。美股可能只返回一个收盘点，并不等于完整实时分钟历史。插件不会通过随机线或插值制造更多数据点。

报价/搜索返回的赋值字符串仅做有界解析，绝不 `eval`。行情价格、源时间与接收时间分开保存，失效/旧缓存不会标为实时或用于触发价位提醒。

## 网络接入方式

- **OTools 安装态**：用现有宿主 `otools_host_http_send` 请求固定 HTTPS 数据源，解码返回 bytes，不依赖网页跨域权限。
- **开发/预览态**：仅绑定 `127.0.0.1` 的同源代理。浏览器请求 `/__market/chart?symbol=sh600519&period=day`，代理依据 allowlist 转到对应公开接口。
- 所有接口 12–15 秒超时、2 MiB 响应上限、只读 GET；不允许任意目标 URL。持股数量、成本、交易和备注不发给行情服务器。

直接 `fetch` 到第三方端点可能被 CORS 拒绝；不要通过禁用浏览器安全或使用不可信开放代理来解决。

## 实测矩阵（2026-11-13）

`pnpm smoke:market` 实际请求以下 9 个组合，校验至少两个真实 OHLC 点、合法日期/量价/高低关系；具体最新结果见 `artifacts/kline-market-smoke.txt`。

| 市场 / 样例 | 日 K | 周 K | 月 K | 返回字段 |
|---|---:|---:|---:|---|
| A 股 / `sh600519` | 121 点 | 120 点 | 120 点 | `qfqday / qfqweek / qfqmonth` |
| 港股 / `hk00700` | 121 点 | 120 点 | 120 点 | `day / week / month` |
| 美股 / `usAAPL.OQ` | 120 点 | 120 点 | 120 点 | `qfqday / qfqweek / qfqmonth` |

观察到 A/港股最新周期为 2026-11-13，美股最新周期为 2026-11-12。数量和日期是实测快照，不是服务保证，下一次请求可能变化。

```bash
pnpm smoke:market
```

标准 `pnpm test` 不依赖外网，包含路由 allowlist、三市场三周期解析、复权回退、按钮切换、坏数据和蜡烛几何测试。
