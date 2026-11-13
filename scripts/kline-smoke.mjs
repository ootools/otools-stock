// Opt-in smoke helpers. No network, application state, or synthetic market data here.
const markets = [
  { name: 'CN', symbol: 'sh600519' },
  { name: 'HK', symbol: 'hk00700' },
  { name: 'US', symbol: 'usAAPL.OQ' },
]
const periods = ['day', 'week', 'month']

export function klineSmokeCases() {
  return markets.flatMap(({ name, symbol }) => periods.map(period => ({
    label: `${name} ${period}`, symbol, period,
    path: `/__market/chart?symbol=${symbol}&period=${period}`,
  })))
}

const numeric = value => (typeof value === 'string' && value.trim() !== '' || typeof value === 'number') && Number.isFinite(Number(value))
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const usableCandle = row => {
  if (!Array.isArray(row) || row.length < 6 || !validDate(row[0])) return false
  if (!row.slice(1, 5).every(value => numeric(value) && Number(value) > 0) || !numeric(row[5]) || Number(row[5]) < 0) return false
  const [open, close, high, low] = row.slice(1, 5).map(Number)
  return high >= Math.max(open, close, low) && low <= Math.min(open, close, high)
}

export function summarizeKline(payload, symbol, period) {
  if (!periods.includes(period)) throw new Error('K线周期无效')
  if (!payload || payload.code !== 0 || !payload.data || typeof payload.data !== 'object') throw new Error('K线行情服务返回错误')
  const stock = payload.data[symbol]
  if (!stock || typeof stock !== 'object') throw new Error('K线历史证券数据缺失')
  const field = Array.isArray(stock[`qfq${period}`]) ? `qfq${period}` : period
  const rows = stock[field]
  if (!Array.isArray(rows)) throw new Error('K线历史周期数据缺失')
  const dates = [...new Set(rows.filter(usableCandle).map(row => row[0]))].sort()
  if (dates.length < 2) throw new Error('K线历史没有至少两个有效数据点')
  return { field, points: dates.length, first: dates[0], last: dates.at(-1) }
}
