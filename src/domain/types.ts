export type Market = 'CN' | 'HK' | 'US'
export type Currency = 'CNY' | 'HKD' | 'USD'
export type Theme = 'dark' | 'light' | 'system'
export type ChartPeriod = 'minute' | 'day' | 'week' | 'month'

export interface Instrument {
  symbol: string
  code: string
  name: string
  market: Market
  currency: Currency
  kind: 'stock' | 'index'
  pinyin?: string
}
export interface OrderLevel { price: number; quantity: number }
export interface Quote {
  symbol: string
  price: number
  previousClose: number | null
  open: number | null
  high: number | null
  low: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
  amount: number | null
  turnover: number | null
  pe: number | null
  marketCap: number | null
  exchangeTime: string
  timestamp: number
  fetchedAt: number
  source: string
  delayed: boolean
  bids: OrderLevel[]
  asks: OrderLevel[]
}
export interface ChartPoint {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  average?: number | null
}
export interface ChartData {
  symbol: string
  period: ChartPeriod
  points: ChartPoint[]
  source: string
  fetchedAt: number
  adjustment: string
}
export interface Trade {
  id: string
  symbol: string
  type: 'opening' | 'buy' | 'sell'
  date: string
  quantity: number
  price: number
  fees: number
  note: string
}
export interface Group { id: string; name: string }
export interface WatchItem { symbol: string; groupId: string; pinned: boolean }
export type AlertMetric = 'price' | 'changePercent'
export interface AlertRule {
  id: string
  symbol: string
  metric: AlertMetric
  direction: 'above' | 'below'
  threshold: number
  enabled: boolean
  cooldownMinutes: number
  armed: boolean
  lastTriggeredAt: number | null
  lastQuoteAt: number | null
}
export interface AlertEvent {
  id: string
  ruleId: string
  symbol: string
  metric: AlertMetric
  direction: 'above' | 'below'
  threshold: number
  value: number
  triggeredAt: number
  exchangeTime: string
}
export interface Settings {
  theme: Theme
  colorScheme: 'red-up' | 'green-up'
  refreshSeconds: 5 | 10 | 15 | 30 | 60
  refreshEnabled: boolean
  pauseWhenHidden: boolean
  sound: boolean
  notifications: boolean
}
export interface AppData {
  version: 1
  instruments: Record<string, Instrument>
  groups: Group[]
  watchlist: WatchItem[]
  trades: Trade[]
  alerts: AlertRule[]
  alertEvents: AlertEvent[]
  settings: Settings
  quoteCache: Record<string, Quote>
}
export interface Position {
  instrument: Instrument
  quantity: number
  cost: number
  averageCost: number | null
  realizedPnl: number
  marketValue: number | null
  unrealizedPnl: number | null
  unrealizedPercent: number | null
  dayPnl: number | null
  quote: Quote | null
}
export interface CurrencySummary {
  currency: Currency
  cost: number
  realizedPnl: number
  marketValue: number | null
  unrealizedPnl: number | null
  dayPnl: number | null
  missingQuotes: number
  missingDayQuotes: number
  positions: number
}
export interface Portfolio { positions: Position[]; summaries: CurrencySummary[] }
export interface MarketProvider {
  quotes(instruments: Instrument[], signal?: AbortSignal): Promise<Quote[]>
  search(query: string, signal?: AbortSignal): Promise<Instrument[]>
  chart(instrument: Instrument, period: ChartPeriod, signal?: AbortSignal): Promise<ChartData>
}
export interface Persistence {
  load(): Promise<unknown | null>
  save(data: AppData): Promise<void>
}
