// Pure route policy shared by browser transport and local preview server.
const canonical = symbol => {
  if (typeof symbol !== 'string' || symbol.length > 24) return false
  if (/^(sh|sz|bj)\d{6}$/.test(symbol)) return !symbol.endsWith('000000')
  if (/^hk\d{5}$/.test(symbol)) return !symbol.endsWith('00000')
  return /^hk(?:HSI|HSCEI)$/.test(symbol) || /^us[A-Z]{1,8}(?:[.-][A-Z]{1,3})?(?:\.(?:OQ|N|PS|A|L|PK))?$/.test(symbol)
}
export function marketTarget(path) {
  if (typeof path !== 'string' || !path.startsWith('/__market/') || /[\r\n\0]/.test(path)) throw new Error('不是允许的行情请求')
  const url = new URL(path, 'http://127.0.0.1')
  if (url.hash || url.username || url.password) throw new Error('行情请求含无效参数')
  const exactKeys = allowed => {
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error('行情请求包含额外参数')
  }
  if (url.pathname === '/__market/quotes') {
    exactKeys(['symbols'])
    const symbols = (url.searchParams.get('symbols') || '').split(',')
    if (!symbols.length || symbols.length > 80 || !symbols.every(canonical)) throw new Error('行情批次或证券代码无效')
    return new URL(`https://qt.gtimg.cn/q=${symbols.join(',')}`)
  }
  if (url.pathname === '/__market/search') {
    exactKeys(['q'])
    const query = url.searchParams.get('q') || ''
    if (!query.trim() || query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) throw new Error('搜索词无效')
    const target = new URL('https://smartbox.gtimg.cn/s3/')
    target.searchParams.set('q', query); target.searchParams.set('t', 'all')
    return target
  }
  if (url.pathname === '/__market/chart') {
    exactKeys(['symbol', 'period'])
    const symbol = url.searchParams.get('symbol') || '', period = url.searchParams.get('period') || ''
    if (!canonical(symbol) || !['minute','day','week','month'].includes(period)) throw new Error('图表证券或周期无效')
    if (period === 'minute') return new URL(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${symbol}`)
    const type = symbol.startsWith('us') ? 'usfqkline' : 'fqkline'
    const target = new URL(`https://web.ifzq.gtimg.cn/appstock/app/${type}/get`)
    target.searchParams.set('param', `${symbol},${period},,,120,qfq`)
    return target
  }
  throw new Error('不支持的行情接口')
}
