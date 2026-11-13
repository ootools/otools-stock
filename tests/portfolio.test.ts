import { describe, it, expect } from 'vitest'
import { buildPortfolio } from '../src/domain/portfolio'
import { instruments, quote, trade } from './fixtures/domain'

const build = (trades: ReturnType<typeof trade>[], quotes = { sh600519: quote() }) => buildPortfolio(trades, instruments, quotes)
describe('portfolio ledger', () => {
  it('includes buy fees and weighted costs then subtracts sell fees', () => {
    const p = build([
      trade(), trade({ price: 110, fees: 5 }),
      trade({ type: 'sell', quantity: 50, price: 120, fees: 3 }),
    ]).positions[0]!
    expect(p.quantity).toBe(150)
    expect(p.cost).toBe(15757.5)
    expect(p.averageCost).toBe(105.05)
    expect(p.realizedPnl).toBe(744.5)
    expect(p.marketValue).toBe(18000)
    expect(p.unrealizedPnl).toBe(2242.5)
    expect(p.dayPnl).toBe(1500)
  })
  it('derives day P&L using overnight quantity, same-day buys/sales and all fees', () => {
    const p = build([
      trade({ type: 'opening', quantity: 100, price: 90, date: '2026-11-10', fees: 0 }),
      trade({ type: 'buy', quantity: 20, price: 115, fees: 2, date: '2026-11-13' }),
      trade({ type: 'sell', quantity: 30, price: 118, fees: 3, date: '2026-11-13' }),
    ]).positions[0]!
    // 90*120 - 100*110 - (20*115+2) + (30*118-3)
    expect(p.quantity).toBe(90)
    expect(p.dayPnl).toBe(1035)
  })
  it('opening stock is pre-market inventory for its date, not a same-day purchase', () => {
    const p = build([trade({ type: 'opening', date: '2026-11-13', fees: 0 })]).positions[0]!
    expect(p.dayPnl).toBe(1000)
  })
  it('preserves zero quantity realized P&L and sells out all fractional allocated costs', () => {
    const p = build([
      trade({ quantity: 3, price: 0.1, fees: 0 }),
      trade({ type: 'sell', quantity: 1, price: 0.2, fees: 0 }),
      trade({ type: 'sell', quantity: 2, price: 0.2, fees: 0 }),
    ]).positions[0]!
    expect(p.quantity).toBe(0)
    expect(p.cost).toBe(0)
    expect(p.realizedPnl).toBeCloseTo(0.3, 8)
  })
  it('supports fractional US shares without floating-point dust', () => {
    const p = buildPortfolio([
      trade({ symbol: 'usAAPL', quantity: 0.1, price: 100, fees: 0 }),
      trade({ symbol: 'usAAPL', quantity: 0.2, price: 100, fees: 0 }),
      trade({ symbol: 'usAAPL', type: 'sell', quantity: 0.3, price: 110, fees: 0 }),
    ], instruments, {}).positions[0]!
    expect(p.quantity).toBe(0)
    expect(p.realizedPnl).toBe(3)
  })
  it('never mixes CNY/HKD/USD or substitutes cost for a missing quote', () => {
    const p = buildPortfolio([
      trade({ symbol: 'sh600519', quantity: 10, fees: 0 }),
      trade({ symbol: 'hk00700', quantity: 10, fees: 0 }),
      trade({ symbol: 'usAAPL', quantity: 10, fees: 0 }),
    ], instruments, { sh600519: quote() })
    expect(p.summaries.map(s => s.currency)).toEqual(['CNY', 'HKD', 'USD'])
    expect(p.summaries[0]!.marketValue).toBe(1200)
    expect(p.summaries[1]).toMatchObject({ marketValue: null, unrealizedPnl: null, missingQuotes: 1 })
    expect(p.positions.find(p => p.instrument.symbol === 'usAAPL')!.marketValue).toBeNull()
  })
  it('does not calculate a day value with a missing or invalid previous close', () => {
    expect(build([trade()], { sh600519: quote({ previousClose: null }) }).positions[0]!.dayPnl).toBeNull()
  })
  it('rejects historical overselling, including edited and out-of-order trades', () => {
    expect(() => build([trade({ type: 'sell', quantity: 1 })])).toThrow(/不足|超卖/)
    expect(() => build([trade({ date: '2026-11-13' }), trade({ type: 'sell', date: '2026-11-12' })])).toThrow(/不足|超卖/)
    expect(() => build([trade(), trade({ type: 'sell', quantity: 101 })])).toThrow(/不足|超卖/)
  })
  it('rejects repeated/late opening records and transactions for an index', () => {
    expect(() => build([trade({ type: 'opening' }), trade({ type: 'opening' })])).toThrow(/期初|存量/)
    expect(() => build([trade(), trade({ type: 'opening', date: '2026-11-13' })])).toThrow(/期初|存量/)
  })
  it('keeps book inventory while a quote predates newer trades, without wrong day P&L', () => {
    const p = build([trade({ date: '2026-11-14' })]).positions[0]!
    expect(p.quantity).toBe(100)
    expect(p.dayPnl).toBeNull()
  })
})

it('does not label an older price as the current value of inventory bought after that quote day',()=>{
 const p=buildPortfolio([trade({date:'2026-11-14'})],instruments,{sh600519:quote()}).positions[0]!
 expect(p.marketValue).toBeNull();expect(p.unrealizedPnl).toBeNull();expect(p.dayPnl).toBeNull()
})
