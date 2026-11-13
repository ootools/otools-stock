import type { Currency, CurrencySummary, Instrument, Portfolio, Position, Quote, Trade } from './types'
import { exchangeDate, validateTrade } from './validation'

const QUANTITY_SCALE = 10_000n
const MONEY_SCALE = 10_000_000_000n
const qty = (value: number) => BigInt(Math.round(value * Number(QUANTITY_SCALE)))
const money = (value: number) => BigInt(Math.round(value * 1_000_000)) * 10_000n
const cash = (t: Trade) => qty(t.quantity) * BigInt(Math.round(t.price * 1_000_000))
const fromMoney = (value: bigint) => Number(value) / Number(MONEY_SCALE)
const rounded = (value: number) => Math.round(value * 1e8) / 1e8

export function buildPortfolio(trades: Trade[], instruments: Record<string, Instrument>, quotes: Record<string, Quote>): Portfolio {
  const bySymbol = new Map<string, Trade[]>()
  for (const trade of trades) {
    validateTrade(trade)
    const instrument = instruments[trade.symbol]
    if (!instrument || instrument.kind === 'index') throw new Error('交易需要有效的股票证券，指数不可持股')
    const rows = bySymbol.get(trade.symbol) || []
    rows.push(trade); bySymbol.set(trade.symbol, rows)
  }
  const positions: Position[] = []
  for (const [symbol, original] of bySymbol) {
    const rows = original.map((t, order) => ({ t, order })).sort((a, b) => a.t.date.localeCompare(b.t.date) || (a.t.type === 'opening' ? -1 : b.t.type === 'opening' ? 1 : a.order - b.order)).map(row => row.t)
    const instrument = instruments[symbol]!
    const candidate = quotes[symbol]
    const quote = candidate && Number.isFinite(candidate.price) && candidate.price > 0 ? candidate : null
    const day = quote ? exchangeDate(quote.exchangeTime) : null
    let quantity = 0n, cost = 0n, realized = 0n, overnight = 0n, dayBuys = 0n, daySells = 0n
    let hasOpening = false, traded = false, hasFuture = false
    for (const t of rows) {
      const quantityDelta = qty(t.quantity)
      if (t.type === 'opening') {
        if (hasOpening || traded) throw new Error('每只股票最多一笔期初存量，且必须早于买卖记录')
        hasOpening = true
      } else traded = true
      if (t.type === 'sell') {
        if (quantityDelta > quantity) throw new Error(`${instrument.name} ${t.date} 持股不足，不能超卖`)
        const allocated = quantityDelta === quantity ? cost : cost * quantityDelta / quantity
        realized += cash(t) - money(t.fees) - allocated
        quantity -= quantityDelta; cost -= allocated
      } else { quantity += quantityDelta; cost += cash(t) + money(t.fees) }
      if (day) {
        if (t.date > day) hasFuture = true
        if (t.date < day || (t.date === day && t.type === 'opening')) overnight += t.type === 'sell' ? -quantityDelta : quantityDelta
        else if (t.date === day && t.type === 'buy') dayBuys += cash(t) + money(t.fees)
        else if (t.date === day && t.type === 'sell') daySells += cash(t) - money(t.fees)
      }
    }
    const shares = Number(quantity) / Number(QUANTITY_SCALE)
    const costValue = fromMoney(cost)
    const marketValue = hasFuture ? null : shares === 0 ? 0 : quote ? rounded(shares * quote.price) : null
    const unrealizedPnl = marketValue === null ? null : rounded(marketValue - costValue)
    let dayPnl: number | null = null
    if (quote && day && !hasFuture && quote.previousClose !== null && quote.previousClose > 0) {
      const currentValue = quantity * BigInt(Math.round(quote.price * 1e6))
      const priorValue = overnight * BigInt(Math.round(quote.previousClose * 1e6))
      dayPnl = fromMoney(currentValue - priorValue - dayBuys + daySells)
    }
    positions.push({ instrument, quantity: shares, cost: costValue, averageCost: shares > 0 ? costValue / shares : null, realizedPnl: fromMoney(realized), marketValue, unrealizedPnl, unrealizedPercent: unrealizedPnl !== null && costValue > 0 ? unrealizedPnl / costValue * 100 : null, dayPnl, quote })
  }
  const summaries: CurrencySummary[] = []
  for (const currency of ['CNY', 'HKD', 'USD'] as Currency[]) {
    const rows = positions.filter(p => p.instrument.currency === currency)
    if (!rows.length) continue
    const active = rows.filter(p => p.quantity > 0)
    const missingQuotes = active.filter(p => p.marketValue === null).length
    const known = rows.filter(p => p.marketValue !== null)
    const knownDay = rows.filter(p => p.dayPnl !== null)
    summaries.push({ currency, cost: rounded(rows.reduce((sum, p) => sum + p.cost, 0)), realizedPnl: rounded(rows.reduce((sum, p) => sum + p.realizedPnl, 0)), marketValue: known.length ? rounded(known.reduce((sum, p) => sum + p.marketValue!, 0)) : null, unrealizedPnl: known.length ? rounded(known.reduce((sum, p) => sum + p.unrealizedPnl!, 0)) : null, dayPnl: knownDay.length ? rounded(knownDay.reduce((sum, p) => sum + p.dayPnl!, 0)) : null, missingQuotes, missingDayQuotes: rows.length - knownDay.length, positions: active.length })
  }
  return { positions, summaries }
}
