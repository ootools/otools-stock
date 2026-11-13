import { marketTarget } from './market-routes.mjs'
import { klineSmokeCases, summarizeKline } from './kline-smoke.mjs'

// Explicitly opt-in: standard tests use offline wire fixtures, never these endpoints.
const requests = [
  { label: 'quotes', path: '/__market/quotes?symbols=sh600519,hk00700,usAAPL', kind: 'quotes' },
  { label: 'search', path: '/__market/search?q=AAPL', kind: 'search' },
  { label: 'HK minute', path: '/__market/chart?symbol=hk00700&period=minute', kind: 'minute', symbol: 'hk00700' },
  ...klineSmokeCases().map(item => ({ ...item, kind: 'kline' })),
]
for (const request of requests) {
  const { label, path, kind, symbol, period } = request
  const response = await fetch(marketTarget(path), { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Referer: 'https://stockapp.finance.qq.com/' } })
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error(`${label}: response exceeds 2 MiB`)
  const text = new TextDecoder(kind === 'quotes' ? 'gb18030' : 'utf-8').decode(bytes)
  if (kind === 'quotes') {
    const count = [...text.matchAll(/v_[a-zA-Z0-9]+="/g)].length
    if (count !== 3) throw new Error('Incomplete quotes')
    console.log(`${label}: HTTP 200, ${count} securities, ${bytes.byteLength} bytes`)
  } else if (kind === 'search') {
    if (!text.includes('aapl.oq')) throw new Error('Unexpected search result')
    console.log(`${label}: HTTP 200, AAPL found`)
  } else if (kind === 'kline') {
    const summary = summarizeKline(JSON.parse(text), symbol, period)
    console.log(`${label}: HTTP 200, ${summary.points} valid candles, ${summary.field}, ${summary.first} → ${summary.last}`)
  } else {
    const data = JSON.parse(text), rows = data.data?.[symbol]?.data?.data
    if (data.code !== 0 || !Array.isArray(rows)) throw new Error(`${label}: provider minute error`)
    const count = rows.filter(row => {
      if (typeof row !== 'string') return false
      const [time, price, volume] = row.trim().split(/\s+/)
      return /^\d{4}$/.test(time) && Number(time.slice(0, 2)) < 24 && Number(time.slice(2)) < 60 && Number.isFinite(Number(price)) && Number(price) > 0 && Number.isFinite(Number(volume)) && Number(volume) >= 0
    }).length
    if (!count) throw new Error(`${label}: no usable minute data`)
    console.log(`${label}: HTTP 200, ${count} valid minute points`)
  }
}
