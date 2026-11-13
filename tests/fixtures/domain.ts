import type { Instrument, Quote, Trade } from '../../src/domain/types'
export const maotai: Instrument = { symbol: 'sh600519', code: '600519', name: '贵州茅台', market: 'CN', currency: 'CNY', kind: 'stock' }
export const tencent: Instrument = { symbol: 'hk00700', code: '00700', name: '腾讯控股', market: 'HK', currency: 'HKD', kind: 'stock' }
export const apple: Instrument = { symbol: 'usAAPL', code: 'AAPL', name: '苹果', market: 'US', currency: 'USD', kind: 'stock' }
export const instruments = { [maotai.symbol]: maotai, [tencent.symbol]: tencent, [apple.symbol]: apple }
export const now = Date.parse('2026-11-13T02:00:00Z')
export const quote = (overrides: Partial<Quote> = {}): Quote => ({
  symbol: 'sh600519', price: 120, previousClose: 110, open: 112, high: 122, low: 108,
  change: 10, changePercent: 9.09, volume: 1000, amount: 120000, turnover: 0.1,
  pe: 20, marketCap: 1000000, exchangeTime: '20261113100000', timestamp: now,
  fetchedAt: now, source: '腾讯财经', delayed: false, bids: [], asks: [], ...overrides,
})
let nextId = 0
export const trade = (overrides: Partial<Trade> = {}): Trade => ({
  id: `trade-${nextId++}`, symbol: 'sh600519', type: 'buy', date: '2026-11-12',
  quantity: 100, price: 100, fees: 5, note: '', ...overrides,
})
