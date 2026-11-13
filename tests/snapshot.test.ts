import { describe, it, expect } from 'vitest'
import { createDefaultData, validateSnapshot, parseBackup, exportCsv } from '../src/domain/snapshot'
import { trade, quote } from './fixtures/domain'

describe('versioned snapshots and backups', () => {
  it('starts with common watchlist and no synthetic prices or holdings', () => {
    const data = createDefaultData()
    expect(data.watchlist.length).toBeGreaterThan(0)
    expect(data.trades).toEqual([])
    expect(data.quoteCache).toEqual({})
    expect(data.settings.refreshSeconds).toBe(15)
    expect(validateSnapshot(data)).toEqual(data)
  })
  it('round trips validated JSON without sharing mutable input references', () => {
    const original = createDefaultData()
    original.trades.push(trade())
    original.quoteCache.sh600519 = quote()
    const restored = parseBackup(JSON.stringify(original))
    expect(restored).toEqual(original)
    restored.trades[0]!.quantity = 1
    expect(original.trades[0]!.quantity).toBe(100)
  })
  it.each([
    { version: 99 }, { version: 1 }, null, [],
  ])('rejects wrong schema %j', value => expect(() => validateSnapshot(value)).toThrow())
  it('rejects invalid symbols, wrong currency, duplicate IDs and broken references', () => {
    const data = createDefaultData()
    data.instruments.sh600519!.currency = 'USD'
    expect(() => validateSnapshot(data)).toThrow(/币种|证券/)
    const good = createDefaultData()
    good.watchlist[0]!.groupId = 'missing'
    expect(() => validateSnapshot(good)).toThrow(/分组/)
    const duplicate = createDefaultData()
    duplicate.trades = [trade({ id: 'same' }), trade({ id: 'same' })]
    expect(() => validateSnapshot(duplicate)).toThrow(/重复/)
  })
  it('rejects non-finite, negative, precision-exceeding trades and impossible dates', () => {
    for (const change of [{ quantity: 0 }, { price: Infinity }, { fees: -1 }, { quantity: 0.00001 }, { price: 0.0000001 }, { date: '2026-02-30' }]) {
      const data = createDefaultData()
      data.trades = [trade(change)]
      expect(() => validateSnapshot(data)).toThrow()
    }
  })
  it('rejects overselling and does not mutate the current state', () => {
    const before = createDefaultData()
    const bad = structuredClone(before)
    bad.trades = [trade({ type: 'sell' })]
    expect(() => validateSnapshot(bad)).toThrow(/不足|超卖/)
    expect(before.trades).toEqual([])
  })
  it('enforces backup byte and list limits', () => {
    expect(() => parseBackup(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MiB|过大/)
    const data = createDefaultData()
    data.alertEvents = Array.from({ length: 201 }, () => ({} as never))
    expect(() => validateSnapshot(data)).toThrow(/数量|记录/)
  })
  it('neutralizes CSV formula injection and preserves UTF-8 names/quotes', () => {
    const csv = exportCsv(['名称', '备注'], [['=CMD()', '+SUM(1)', '-1', '@test', '你好, "世界"']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain("'=CMD()")
    expect(csv).toContain("'+SUM(1)")
    expect(csv).toContain("'@test")
    expect(csv).toContain('"你好, ""世界"""')
  })
})

it('valid state must remain within the byte limit that its own backup parser accepts',()=>{
 const data=createDefaultData()
 data.trades=Array.from({length:5000},(_,i)=>trade({id:`row-${i}`,note:'中'.repeat(500),quantity:1,price:1,fees:0}))
 expect(()=>validateSnapshot(data)).toThrow(/2 MiB|过大/)
})
it('rejects a cached quote whose timestamp does not correspond to its market time',()=>{
 const data=createDefaultData();data.quoteCache.sh600519=quote({exchangeTime:'20261113080000'})
 expect(()=>validateSnapshot(data)).toThrow(/时间/)
})
