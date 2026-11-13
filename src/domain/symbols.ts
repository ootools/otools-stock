import type { Instrument, Market } from './types'

const cnExchange = (code: string): string | null => {
  if (!/^\d{6}$/.test(code) || /^0{6}$/.test(code)) return null
  if (/^(900|200)/.test(code)) return null
  if (/^(92|[48])/.test(code)) return 'bj'
  if (/^[569]/.test(code)) return 'sh'
  if (/^[0123]/.test(code)) return 'sz'
  return null
}
export function normalizeSymbol(input: string): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value || value.length > 24) return null
  if (/^hk(hsi|hscei)$/i.test(value)) return `hk${value.slice(2).toUpperCase()}`
  const cn = /^(sh|sz|bj)[.:]?(\d{6})$/i.exec(value)
  if (cn) {
    const exchange = cn[1]!.toLowerCase(), code = cn[2]!
    if (exchange === 'sh' && /^000\d{3}$/.test(code) && code !== '000000') return `sh${code}`
    return cnExchange(code) === exchange ? `${exchange}${code}` : null
  }
  if (/^\d{6}$/.test(value)) { const exchange = cnExchange(value); return exchange ? exchange + value : null }
  const hk = /^(?:hk[.:]?(\d{1,5})|(\d{1,5})\.hk|(\d{5}))$/i.exec(value)
  if (hk) { const code = (hk[1] || hk[2] || hk[3])!; return Number(code) > 0 ? `hk${code.padStart(5, '0')}` : null }
  const explicit=/^us[.:]/i.test(value)||value.startsWith('us')
  const us = (explicit?value.replace(/^us[.:]?/i, ''):value).toUpperCase()
  return /^[A-Z]{1,8}(?:[.-][A-Z]{1,3})?$/.test(us) ? `us${us}` : null
}
export function instrumentFromSymbol(symbol: string, name: string, kind: Instrument['kind'] = 'stock'): Instrument {
  const normalized = normalizeSymbol(symbol)
  if (!normalized) throw new Error('无效的证券代码')
  const market: Market = normalized.startsWith('hk') ? 'HK' : normalized.startsWith('us') ? 'US' : 'CN'
  const isIndex = /^sh000\d{3}$/.test(normalized)||/^sz399\d{3}$/.test(normalized)||/^hk(?:HSI|HSCEI)$/.test(normalized)
  return { symbol: normalized, code: normalized.slice(2), name: name.trim() || normalized.slice(2), market, currency: market === 'CN' ? 'CNY' : market === 'HK' ? 'HKD' : 'USD', kind: isIndex ? 'index' : kind }
}
const catalogRows = [
  ['sh600519', '贵州茅台', 'gzmt guizhoumaotai'], ['sz300750', '宁德时代', 'ndsd ningdeshidai'],
  ['sz000001', '平安银行', 'payh pinganyinhang'], ['sh600036', '招商银行', 'zsyh zhaoshangyinhang'],
  ['sz000858', '五粮液', 'wly wuliangye'], ['sz002594', '比亚迪', 'byd biyadi'],
  ['sh601318', '中国平安', 'zgpa zhongguopingan'], ['sh601398', '工商银行', 'gsyh gongshangyinhang'],
  ['sz300059', '东方财富', 'dfcf dongfangcaifu'], ['sh600030', '中信证券', 'zxzq zhongxinzhengquan'],
  ['sh510300', '沪深300ETF', 'hs300 etf'], ['sh688981', '中芯国际', 'zxgj zhongxinguoji'],
  ['hk00700', '腾讯控股', 'txkg tencent'], ['hk09988', '阿里巴巴', 'albb alibaba'],
  ['hk03690', '美团', 'mt meituan'], ['hk01810', '小米集团', 'xmjt xiaomi'],
  ['usAAPL', '苹果', 'pg apple'], ['usMSFT', '微软', 'wr microsoft'],
  ['usNVDA', '英伟达', 'ywd nvidia'], ['usTSLA', '特斯拉', 'tsl tesla'], ['usAMZN', '亚马逊', 'ymx amazon'],
] as const
export const INDEXES: Instrument[] = [
  instrumentFromSymbol('sh000001', '上证指数', 'index'),
  instrumentFromSymbol('sz399001', '深证成指', 'index'),
  instrumentFromSymbol('sz399006', '创业板指', 'index'),
  instrumentFromSymbol('hkHSI', '恒生指数', 'index'),
].filter(Boolean)

export const CATALOG: Instrument[] = catalogRows.map(([symbol, name, pinyin]) => ({ ...instrumentFromSymbol(symbol, name), pinyin }))
export function searchCatalog(query: string): Instrument[] {
  const term = query.trim().toLowerCase()
  if (!term) return CATALOG.slice(0, 8)
  return [...CATALOG, ...INDEXES].filter(stock => [stock.name, stock.symbol, stock.code, stock.pinyin || ''].some(value => value.toLowerCase().includes(term))).slice(0, 20)
}
