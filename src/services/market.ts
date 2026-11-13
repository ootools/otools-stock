import type { ChartData, ChartPeriod, ChartPoint, Instrument, MarketProvider, Quote } from '../domain/types'
import { instrumentFromSymbol, normalizeSymbol } from '../domain/symbols'
import { validDate } from '../domain/validation'
import { parseExchangeTimestamp } from '../domain/market-time'
export { parseExchangeTimestamp } from '../domain/market-time'
import { createHttpTransport } from './http'
export type TextTransport = (path: string, signal?: AbortSignal, encoding?: string) => Promise<string>
export const MARKET_SOURCE = '腾讯财经 · 公开行情'
const numeric = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (String(value).trim() === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
const positive = (value: unknown): number | null => { const n = numeric(value); return n !== null && n > 0 ? n : null }
const nonnegative = (value: unknown): number | null => { const n = numeric(value); return n !== null && n >= 0 ? n : null }
const scaled = (value: number | null, scale: number) => value === null ? null : value * scale
const decodeEscapes = (value: string) => value.replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16))).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
const lines = (text: string): [string, string[]][] => [...text.matchAll(/(?:^|[;\r\n])\s*v_([A-Za-z0-9._-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*;?/g)].map(match => [match[1]!, decodeEscapes(match[2]!).split('~')])


export function parseTencentQuotes(text: string, instruments: Instrument[], now: number): Quote[] {
  const requested = new Map(instruments.map(stock => [stock.symbol, stock]))
  const result: Quote[] = []
  for (const [symbol, f] of lines(text)) {
    const stock = requested.get(symbol)
    if (!stock) continue
    const price = positive(f[3])
    if (price === null) continue
    const previousClose = positive(f[4]), timestamp = parseExchangeTimestamp(f[30] || '',stock.market)
    const multiplier = stock.market === 'CN' ? 100 : 1
    const level = (start: number) => Array.from({length:5},(_,i)=>({ price:positive(f[start+i*2]),quantity:nonnegative(f[start+i*2+1]) })).filter((p): p is {price:number;quantity:number}=>p.price!==null && p.quantity!==null && p.quantity>0).map(p=>({price:p.price,quantity:p.quantity*multiplier}))
    result.push({
      symbol, price, previousClose, open:positive(f[5]),high:positive(f[33]),low:positive(f[34]),
      change:numeric(f[31]) ?? (previousClose===null ? null : Math.round((price-previousClose)*1e6)/1e6),
      changePercent:numeric(f[32]) ?? (previousClose===null ? null : (price-previousClose)/previousClose*100),
      volume:scaled(nonnegative(f[36]) ?? nonnegative(f[6]),multiplier),
      amount:scaled(nonnegative(f[37]),stock.market==='CN'?10000:1),turnover:nonnegative(f[38]),pe:numeric(f[39]),marketCap:scaled(nonnegative(f[45]),1e8),
      exchangeTime:f[30] || '',timestamp,fetchedAt:now,source:MARKET_SOURCE,delayed:stock.market!=='CN',bids:level(9),asks:level(19),
    })
  }
  return result
}
export function parseSearch(text: string): Instrument[] {
  const match = /v_hint\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(text)
  if (!match) return []
  const results: Instrument[] = []
  for (const entry of decodeEscapes(match[1]!).split('^').slice(0,30)) {
    const [exchange,rawCode,name,pinyin,type] = entry.split('~')
    if (!exchange || !rawCode || !name || !type || !/^(GP|GP-A|GP-B|JJ|ETF)$/.test(type)) continue
    const code = exchange.toLowerCase()==='us' ? rawCode.replace(/\.(?:oq|n|ps|a|l|pk)$/i,'') : rawCode
    const symbol = normalizeSymbol(`${exchange}${code}`)
    if (!symbol) continue
    const stock = instrumentFromSymbol(symbol,name)
    if (stock.kind==='index' || results.some(s=>s.symbol===symbol)) continue
    results.push({ ...stock,pinyin:pinyin || '' })
  }
  return results
}
export function parseChart(text: string, instrument: Instrument, period: ChartPeriod, now: number): ChartData {
  let response: { code?: number; data?: Record<string, Record<string, unknown>> }
  try { response = JSON.parse(text) } catch { throw new Error('图表返回了无效数据') }
  if (response.code !== 0 || !response.data || typeof response.data!=='object') throw new Error('图表行情服务暂不可用')
  const key = Object.keys(response.data).find(key=>key===instrument.symbol || (instrument.market==='US' && key.replace(/\.(?:OQ|N|PS|A|L|PK)$/i,'')===instrument.symbol))
  const payload = key ? response.data[key] : null
  if (!payload || typeof payload!=='object') throw new Error('暂无该证券的图表行情')
  const points: ChartPoint[] = []
  const multiplier = instrument.market==='CN' ? 100 : 1
  let adjusted = false
  if (period==='minute') {
    const minute = payload.data as { data?: unknown[] } | undefined
    const raw = minute?.data
    let previousVolume = 0
    if (Array.isArray(raw)) for (const item of raw.slice(0,600)) {
      if (typeof item!=='string') continue
      const [t,p,v,a] = item.trim().split(/\s+/)
      const price = positive(p), cumulative = nonnegative(v), totalAmount = nonnegative(a)
      if (!t || !/^\d{4}$/.test(t) || Number(t.slice(0,2))>23 || Number(t.slice(2))>59 || price===null || cumulative===null) continue
      const volume = Math.max(0,cumulative-previousVolume)*multiplier
      previousVolume=cumulative
      points.push({ time:`${t.slice(0,2)}:${t.slice(2)}`,open:price,close:price,high:price,low:price,volume,average:totalAmount!==null && cumulative>0 ? totalAmount/(cumulative*multiplier) : null })
    }
  } else {
    const raw = payload[`qfq${period}`] || payload[period]
    adjusted=Array.isArray(payload[`qfq${period}`])
    if (Array.isArray(raw)) for (const row of raw.slice(-160)) {
      if (!Array.isArray(row) || !validDate(row[0])) continue
      const [open,close,high,low] = row.slice(1,5).map(positive)
      const volume = nonnegative(row[5])
      if (open==null||close==null||high==null||low==null||volume==null||high<Math.max(open,close,low)||low>Math.min(open,close,high)) continue
      points.push({time:row[0],open,close,high,low,volume:volume*multiplier})
    }
  }
  const deduplicated = [...new Map(points.map(p=>[p.time,p])).values()].sort((a,b)=>a.time.localeCompare(b.time))
  if (!deduplicated.length) throw new Error(period==='minute' ? '暂无有效分时数据；可切换 K 线查看' : '暂无有效 K 线数据')
  return {symbol:instrument.symbol,period,points:deduplicated,source:MARKET_SOURCE,fetchedAt:now,adjustment:period==='minute'?'分时 · 交易所时间':adjusted?'前复权':'未复权'}
}
export function createMarketProvider(transport: TextTransport = createHttpTransport(), now: ()=>number = Date.now): MarketProvider {
  const venues = new Map<string,string>()
  const learnVenue = (text: string) => {
    for (const [symbol,fields] of lines(text)) {
      if (symbol.startsWith('us') && /^[A-Z]{1,8}(?:[.-][A-Z]{1,3})?\.(?:OQ|N|PS|A|L|PK)$/i.test(fields[2] || '')) venues.set(symbol,`us${fields[2]!.toUpperCase()}`)
    }
  }
  return {
    async quotes(instruments,signal) {
      if (!instruments.length) return []
      const unique = [...new Map(instruments.map(s=>[s.symbol,s])).values()]
      const quotes: Quote[] = []
      for (let start=0;start<unique.length;start+=80) {
        const batch=unique.slice(start,start+80)
        const text=await transport(`/__market/quotes?symbols=${batch.map(s=>s.symbol).join(',')}`,signal,'gb18030')
        learnVenue(text); quotes.push(...parseTencentQuotes(text,batch,now()))
      }
      if (!quotes.length) throw new Error('未取得有效行情，数据源可能暂不可用')
      return quotes
    },
    async search(query,signal) {
      const text=await transport(`/__market/search?q=${encodeURIComponent(query.trim())}`,signal,'utf-8')
      if(!/v_hint\s*=\s*"/.test(text))throw new Error('在线搜索返回了无效格式')
      return parseSearch(text)
    },
    async chart(instrument,period,signal) {
      if (period!=='minute' && instrument.market==='US' && !venues.has(instrument.symbol)) {
        const text=await transport(`/__market/quotes?symbols=${instrument.symbol}`,signal,'gb18030'); learnVenue(text)
      }
      const symbol=period==='minute'?instrument.symbol:venues.get(instrument.symbol) || instrument.symbol
      const text=await transport(`/__market/chart?symbol=${symbol}&period=${period}`,signal,'utf-8')
      return parseChart(text,instrument,period,now())
    },
  }
}
