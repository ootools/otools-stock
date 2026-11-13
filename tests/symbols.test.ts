import { describe, expect, it } from 'vitest'
import { normalizeSymbol, instrumentFromSymbol, searchCatalog } from '../src/domain/symbols'

describe('stock identifiers', () => {
  it.each([
    ['600519', 'sh600519'], ['SH.600519', 'sh600519'], ['sz000001', 'sz000001'],
    ['000001', 'sz000001'], ['300750', 'sz300750'], ['688001', 'sh688001'],
    ['920001', 'bj920001'], ['00700', 'hk00700'], ['hk700', 'hk00700'],
    ['700.HK', 'hk00700'], ['AAPL', 'usAAPL'], ['usaapl', 'usAAPL'], ['BRK.B', 'usBRK.B'],
  ])('normalizes %s without confusing exchanges', (input, expected) => expect(normalizeSymbol(input)).toBe(expected))
  it.each(['', 'https://evil.test', 'sh600519&x=1', '../AAPL', 'sh600519,usAAPL', 'abc123', '1234567', 'sz600519', 'sh300750', '000000', 'hk00000', 'foo()'])('rejects %s', value => expect(normalizeSymbol(value)).toBeNull())
  it('derives currency from symbol rather than user input', () => {
    expect(instrumentFromSymbol('usAAPL', '苹果')).toMatchObject({ currency: 'USD', market: 'US', code: 'AAPL' })
    expect(instrumentFromSymbol('hk00700', '腾讯控股')).toMatchObject({ currency: 'HKD', market: 'HK' })
    expect(instrumentFromSymbol('sh000001', '上证指数', 'index').kind).toBe('index')
  })
  it('searches common names, codes and pinyin locally', () => {
    expect(searchCatalog('茅台')[0]?.symbol).toBe('sh600519')
    expect(searchCatalog('gzmt')[0]?.symbol).toBe('sh600519')
    expect(searchCatalog('aapl')[0]?.symbol).toBe('usAAPL')
  })
})

it('preserves bare US tickers starting with US and recognizes all supported index prefixes',()=>{
 expect(normalizeSymbol('USO')).toBe('usUSO')
 expect(normalizeSymbol('US.AAPL')).toBe('usAAPL')
 expect(instrumentFromSymbol('sh000300','沪深300').kind).toBe('index')
 expect(instrumentFromSymbol('sz399330','深证100').kind).toBe('index')
})
it('does not mislabel B-shares as CNY A-shares',()=>{
 expect(normalizeSymbol('sh900901')).toBeNull()
 expect(normalizeSymbol('sz200002')).toBeNull()
})
