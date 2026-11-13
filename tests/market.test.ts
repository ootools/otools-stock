import { describe, it, expect, vi } from 'vitest'
import { parseTencentQuotes, parseSearch, parseChart, createMarketProvider, parseExchangeTimestamp } from '../src/services/market'
import { maotai, tencent, apple } from './fixtures/domain'
import { cnWire, hkWire, usWire, wireQuote, dayWire, minuteWire, searchWire } from './fixtures/market'

describe('real market wire normalization', () => {
  it('decodes the A-share fields and converts lots / ten-thousand yuan into base units', () => {
    const [q] = parseTencentQuotes(cnWire, [maotai], 1)
    expect(q).toMatchObject({ symbol: 'sh600519', price:1427.95, changePercent:1.25, volume:2049200, amount:2903920000, timestamp:Date.parse('2026-11-13T04:05:35Z'), marketCap:1785054000000, bids:[{ price:1426.37, quantity:300 }] })
  })
  it('does not apply mainland volume/amount scales to HK/US shares', () => {
    const q = parseTencentQuotes(hkWire+'\n'+usWire, [tencent, apple], 1)
    expect(q[0]).toMatchObject({ volume:16478133, amount:6444405641.468, delayed:true })
    expect(q[1]).toMatchObject({ volume:31874978, amount:11361383723, timestamp:Date.parse('2026-11-12T21:00:01Z'), delayed:true })
  })
  it('uses New York DST for American exchange times and rejects impossible timestamps', () => {
    expect(parseExchangeTimestamp('2026-07-01 16:00:00', 'US')).toBe(Date.parse('2026-07-01T20:00:00Z'))
    expect(parseExchangeTimestamp('2026-02-30 16:00:00', 'CN')).toBe(0)
    expect(parseExchangeTimestamp('20261113990000', 'CN')).toBe(0)
  })
  it('does not turn empty/delisted data into price zero or execute JS', () => {
    expect(parseTencentQuotes('v_sh600519="";window.pwn=true;', [maotai], 1)).toEqual([])
    const [q] = parseTencentQuotes(wireQuote('sh600519',{3:'10',30:'20261113100000'}), [maotai], 1)
    expect(q!.previousClose).toBeNull()
    expect(q!.changePercent).toBeNull()
    expect(q!.amount).toBeNull()
    expect(q!.bids).toEqual([])
    expect((globalThis as Record<string, unknown>).pwn).toBeUndefined()
  })
  it('only accepts quoted lines belonging to requested normalized securities', () => {
    expect(parseTencentQuotes(cnWire+hkWire, [maotai], 1)).toHaveLength(1)
  })
  it('parses escaped names without eval and strips US venue suffixes', () => {
    const rows = parseSearch(searchWire)
    expect(rows.map(s=>s.symbol)).toEqual(['sh600519','hk00700','usAAPL'])
    expect(rows[0]!.name).toBe('贵州茅台')
    expect(rows[2]).toMatchObject({ code:'AAPL', currency:'USD' })
    expect(parseSearch('v_hint="sh~000847~腾讯济安~txja~ZS^hk~13005~衍生品~x~QZ"')).toEqual([])
  })
  it('normalizes forward-adjusted candles and minute incremental volumes/weighted average', () => {
    const chart = parseChart(dayWire, maotai, 'day', 1)
    expect(chart.points[0]).toMatchObject({ time:'2026-11-12',open:1395.13,close:1410.27,volume:3237300 })
    const minute = parseChart(minuteWire, maotai, 'minute', 1)
    expect(minute.points[1]).toMatchObject({ time:'09:31',volume:71400,close:1397.51 })
    expect(minute.points[0]!.average).toBe(1404)
    expect(minute.adjustment).toContain('分时')
  })
  it('rejects empty/malformed histories and candles with inconsistent high/low', () => {
    expect(()=>parseChart('{"code":1,"msg":"failed"}', maotai, 'day',1)).toThrow()
    expect(()=>parseChart('{"code":0,"data":{}}', maotai, 'day',1)).toThrow(/暂无|缺少/)
    const invalid = JSON.stringify({code:0,data:{sh600519:{day:[['2026-11-13','10','11','9','12','1']]}}})
    expect(()=>parseChart(invalid,maotai,'day',1)).toThrow(/暂无|有效/)
  })
  it('requests the provider via injected transport and learns US chart venue from quote fields', async () => {
    const transport = vi.fn().mockResolvedValueOnce(usWire).mockResolvedValueOnce(JSON.stringify({code:0,data:{'usAAPL.OQ':{qfqday:[['2026-11-12','357.81','354.88','359.37','354.41','31874978']]}}}))
    const provider = createMarketProvider(transport, ()=>1)
    await provider.quotes([apple])
    const chart = await provider.chart(apple,'day')
    expect(chart.points).toHaveLength(1)
    expect(transport.mock.calls[1]![0]).toContain('symbol=usAAPL.OQ')
    expect(transport.mock.calls[1]![0]).toContain('period=day')
  })
  it('refuses a batch with no usable quote rather than faking a successful refresh', async () => {
    const provider = createMarketProvider(vi.fn().mockResolvedValue('v_sh600519="";'))
    await expect(provider.quotes([maotai])).rejects.toThrow(/行情/)
  })
})

it('uses bare US ticker for minute snapshots while venue suffix is only for historical candles',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(usWire).mockResolvedValueOnce(JSON.stringify({code:0,data:{usAAPL:{data:{date:'20261112',data:['1600 354.88 31874978']}}}}))
 const provider=createMarketProvider(transport,()=>1)
 await provider.quotes([apple]);const chart=await provider.chart(apple,'minute')
 expect(transport.mock.calls[1]![0]).toBe('/__market/chart?symbol=usAAPL&period=minute')
 expect(chart.points).toHaveLength(1);expect(chart.points[0]!.close).toBe(354.88)
})

it('reports a search provider error instead of silently treating an error page as no results',async()=>{
 const provider=createMarketProvider(vi.fn().mockResolvedValue('<html>temporarily unavailable</html>'))
 await expect(provider.search('unknown')).rejects.toThrow(/搜索|格式/)
})

it.each([
 [maotai,'day'],[maotai,'week'],[maotai,'month'],
 [tencent,'day'],[tencent,'week'],[tencent,'month'],
 [apple,'day'],[apple,'week'],[apple,'month'],
] as const)('normalizes public history for $0.symbol $1 without mistaking period or foreign volume units', (stock, period) => {
 const key = stock.market==='US'?'usAAPL.OQ':stock.symbol
 const field = stock.market==='HK'?period:`qfq${period}`
 const wire = JSON.stringify({code:0,data:{[key]:{[field]:[['2026-11-12','100','110','115','98','3000'],['2026-11-13','110','108','112','105','2000']]}}})
 const chart=parseChart(wire,stock,period,1)
 expect(chart.period).toBe(period)
 expect(chart.symbol).toBe(stock.symbol)
 expect(chart.adjustment).toBe(stock.market==='HK'?'未复权':'前复权')
 expect(chart.points[0]).toMatchObject({time:'2026-11-12',open:100,close:110,high:115,low:98,volume:stock.market==='CN'?300000:3000})
 expect(chart.points).toHaveLength(2)
})
