import type { AlertEvent, AlertRule, AppData, ChartPeriod, Group, Instrument, OrderLevel, Quote, Settings, Trade, WatchItem } from './types'
import { CATALOG, INDEXES, instrumentFromSymbol, normalizeSymbol } from './symbols'
import { buildPortfolio } from './portfolio'
import { validateTrade } from './validation'
import { parseExchangeTimestamp } from './market-time'

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024
export const LIMITS = { instruments: 500, groups: 50, watchlist: 500, trades: 10000, alerts: 500, alertEvents: 200 }
const fail = (message: string): never => { throw new Error(message) }
const record = (value: unknown, label: string): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail(`${label}格式不正确`)
const text = (value: unknown, label: string, max = 100, empty = false): string => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value : fail(`${label}无效或过长`)
const bool = (value: unknown, label: string): boolean => typeof value === 'boolean' ? value : fail(`${label}必须为布尔值`)
const finite = (value: unknown, label: string, min = -1e15, max = 1e15): number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail(`${label}不是有效数字`)
const nullable = (value: unknown, label: string, min = -1e15, max = 1e15): number | null => value === null ? null : finite(value, label, min, max)
const id = (value: unknown, label = 'ID'): string => {
  const result = text(value, label, 100)
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result) ? result : fail(`${label}无效`)
}
const list = (value: unknown, label: keyof typeof LIMITS): unknown[] => Array.isArray(value) && value.length <= LIMITS[label] ? value : fail(`${label}记录数量超过限制或格式不正确`)
const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) fail(`${label}ID重复`) }
const symbol = (value: unknown): string => {
  const raw = text(value, '证券代码', 24)
  return normalizeSymbol(raw) === raw ? raw : fail('证券代码必须是规范格式')
}
export const DEFAULT_SETTINGS: Settings = { theme: 'dark', colorScheme: 'red-up', refreshSeconds: 15, refreshEnabled: true, pauseWhenHidden: false, sound: false, notifications: false }
export function createDefaultData(): AppData {
  const instruments = Object.fromEntries([...CATALOG, ...INDEXES].map(s => [s.symbol, { ...s }]))
  return {
    version: 1, instruments, groups: [{ id: 'default', name: '我的自选' }, { id: 'focus', name: '重点关注' }],
    watchlist: ['sh600519', 'sz300750', 'sh600036', 'sz002594', 'hk00700', 'usAAPL'].map(symbol => ({ symbol, groupId: 'default', pinned: symbol === 'sh600519' })),
    trades: [], alerts: [], alertEvents: [], settings: { ...DEFAULT_SETTINGS }, quoteCache: {},
  }
}
export function validateInstrument(value: unknown, expected?: string): Instrument {
  const s = record(value, '证券'), key = symbol(s.symbol)
  if (expected !== undefined && key !== expected) fail('证券代码与键值不一致')
  const kind = s.kind === 'stock' || s.kind === 'index' ? s.kind : fail('证券类型无效')
  const result = instrumentFromSymbol(key, text(s.name, '证券名称', 80), kind)
  if (s.currency !== result.currency || s.market !== result.market || s.code !== result.code || s.kind !== result.kind) fail('证券市场、币种或代码不一致')
  return { ...result, ...(s.pinyin !== undefined ? { pinyin: text(s.pinyin, '拼音', 150, true) } : {}) }
}
export function validateQuote(value: unknown, expected: string): Quote {
  const q = record(value, '行情')
  if (symbol(q.symbol) !== expected) fail('行情证券不匹配')
  const levels = (value: unknown): OrderLevel[] => {
    if (!Array.isArray(value) || value.length > 5) fail('行情五档格式无效')
    return (value as unknown[]).map(entry => { const r = record(entry, '五档'); return { price: finite(r.price, '委托价', 0.000001, 1e9), quantity: finite(r.quantity, '委托量', 0, 1e15) } })
  }
  const stock=instrumentFromSymbol(expected,expected)
  const expectedTimestamp=parseExchangeTimestamp(typeof q.exchangeTime==='string'?q.exchangeTime:'',stock.market)
  if(q.timestamp!==expectedTimestamp)fail('行情时间戳与交易所时间不一致')
  return { symbol: expected, price: finite(q.price, '现价', 0.000001, 1e9), previousClose: nullable(q.previousClose, '昨收', 0, 1e9), open: nullable(q.open, '开盘', 0, 1e9), high: nullable(q.high, '最高', 0, 1e9), low: nullable(q.low, '最低', 0, 1e9), change: nullable(q.change, '涨跌', -1e9, 1e9), changePercent: nullable(q.changePercent, '涨跌幅', -100, 1e8), volume: nullable(q.volume, '成交量', 0), amount: nullable(q.amount, '成交额', 0, 1e18), turnover: nullable(q.turnover, '换手率', 0, 1e8), pe: nullable(q.pe, '市盈率', -1e9, 1e9), marketCap: nullable(q.marketCap, '市值', 0, 1e18), exchangeTime: text(q.exchangeTime, '行情时间', 32, true), timestamp: finite(q.timestamp, '行情时间戳', 0, 1e14), fetchedAt: finite(q.fetchedAt, '接收时间', 0, 1e14), source: text(q.source, '行情来源', 80), delayed: bool(q.delayed, '延时标志'), bids: levels(q.bids), asks: levels(q.asks) }
}
export function validateSnapshot(value: unknown): AppData {
  const data = record(value, '备份')
  if(new TextEncoder().encode(JSON.stringify(data)).byteLength>MAX_BACKUP_BYTES)fail('备份过大，上限 2 MiB')
  if (data.version !== 1) fail('备份版本不支持，请使用 v1 快照')
  const instrumentRows = record(data.instruments, '证券目录')
  if (Object.keys(instrumentRows).length > LIMITS.instruments) fail('证券数量超过限制')
  const instruments: Record<string, Instrument> = Object.create(null)
  for (const [key, value] of Object.entries(instrumentRows)) instruments[key] = validateInstrument(value, key)
  const requireStock = (key: unknown, trading = false): string => {
    const result = symbol(key)
    if (!instruments[result]) fail('记录引用了不存在的证券')
    if (trading && instruments[result]!.kind === 'index') fail('指数不可持股')
    return result
  }
  const groups: Group[] = list(data.groups, 'groups').map(value => { const g = record(value, '分组'); return { id: id(g.id, '分组ID'), name: text(g.name, '分组名称', 24) } })
  unique(groups.map(g => g.id), '分组')
  if (!groups.length) fail('至少保留一个自选分组')
  const watchlist: WatchItem[] = list(data.watchlist, 'watchlist').map(value => {
    const w = record(value, '自选'), groupId = id(w.groupId, '分组ID')
    if (!groups.some(g => g.id === groupId)) fail('自选引用了不存在的分组')
    return { symbol: requireStock(w.symbol), groupId, pinned: bool(w.pinned, '置顶') }
  })
  unique(watchlist.map(w => w.symbol), '自选')
  const trades: Trade[] = list(data.trades, 'trades').map(value => {
    const t = record(value, '交易')
    const result: Trade = { id: id(t.id, '交易ID'), symbol: requireStock(t.symbol, true), type: t.type as Trade['type'], date: text(t.date, '交易日期', 10), quantity: finite(t.quantity, '数量'), price: finite(t.price, '成交价'), fees: finite(t.fees, '费用'), note: text(t.note, '备注', 500, true) }
    validateTrade(result)
    return result
  })
  unique(trades.map(t => t.id), '交易')
  const alerts: AlertRule[] = list(data.alerts, 'alerts').map(value => {
    const a = record(value, '提醒')
    const metric = a.metric === 'price' || a.metric === 'changePercent' ? a.metric : fail('提醒指标无效')
    const direction = a.direction === 'above' || a.direction === 'below' ? a.direction : fail('提醒方向无效')
    const threshold = finite(a.threshold, '提醒阈值', metric === 'price' ? 0.000001 : -100, metric === 'price' ? 1e9 : 1e8)
    return { id: id(a.id, '提醒ID'), symbol: requireStock(a.symbol), metric, direction, threshold, enabled: bool(a.enabled, '提醒开关'), cooldownMinutes: finite(a.cooldownMinutes, '冷却时间', 1, 1440), armed: bool(a.armed, '提醒武装'), lastTriggeredAt: nullable(a.lastTriggeredAt, '提醒触发时间', 0, 1e14), lastQuoteAt: nullable(a.lastQuoteAt, '提醒行情时间', 0, 1e14) }
  })
  unique(alerts.map(a => a.id), '提醒')
  const alertEvents: AlertEvent[] = list(data.alertEvents, 'alertEvents').map(value => {
    const e = record(value, '触发记录')
    const metric = e.metric === 'price' || e.metric === 'changePercent' ? e.metric : fail('触发记录指标无效')
    const direction = e.direction === 'above' || e.direction === 'below' ? e.direction : fail('触发记录方向无效')
    return { id: id(e.id), ruleId: id(e.ruleId), symbol: requireStock(e.symbol), metric, direction, threshold: finite(e.threshold, '阈值'), value: finite(e.value, '触发值'), triggeredAt: finite(e.triggeredAt, '触发时间', 0, 1e14), exchangeTime: text(e.exchangeTime, '交易所时间', 32, true) }
  })
  unique(alertEvents.map(e => e.id), '触发记录')
  const settingsRow = record(data.settings, '设置')
  const theme = ['dark', 'light', 'system'].includes(settingsRow.theme as string) ? settingsRow.theme as Settings['theme'] : fail('主题无效')
  const colorScheme = settingsRow.colorScheme === 'red-up' || settingsRow.colorScheme === 'green-up' ? settingsRow.colorScheme : fail('涨跌配色无效')
  const refreshSeconds = [5, 10, 15, 30, 60].includes(settingsRow.refreshSeconds as number) ? settingsRow.refreshSeconds as Settings['refreshSeconds'] : fail('刷新间隔无效')
  const settings: Settings = { theme, colorScheme, refreshSeconds, refreshEnabled: bool(settingsRow.refreshEnabled, '自动刷新'), pauseWhenHidden: bool(settingsRow.pauseWhenHidden, '隐藏节能'), sound: bool(settingsRow.sound, '声音'), notifications: bool(settingsRow.notifications, '系统通知') }
  const quoteCache: Record<string, Quote> = Object.create(null)
  const cache = record(data.quoteCache, '行情缓存')
  if (Object.keys(cache).length > LIMITS.instruments) fail('行情缓存数量过多')
  for (const [key, value] of Object.entries(cache)) quoteCache[requireStock(key)] = validateQuote(value, key)
  buildPortfolio(trades, instruments, {})
  return { version: 1, instruments, groups, watchlist, trades, alerts, alertEvents, settings, quoteCache }
}
export function parseBackup(input: string): AppData {
  if (new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) fail('备份过大，上限 2 MiB')
  try { return validateSnapshot(JSON.parse(input.replace(/^\uFEFF/, ''))) }
  catch (error) { throw new Error(error instanceof SyntaxError ? '备份不是有效的 JSON 文件' : error instanceof Error ? error.message : '备份无效') }
}
export function exportCsv(headers: string[], rows: unknown[][]): string {
  const cell = (value: unknown): string => {
    let text = value == null ? '' : String(value)
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export const CHART_PERIODS: ChartPeriod[] = ['minute', 'day', 'week', 'month']
