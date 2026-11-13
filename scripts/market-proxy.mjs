import { marketTarget } from './market-routes.mjs'
export { marketTarget }
export const MAX_MARKET_BYTES = 2 * 1024 * 1024

export function marketProxy() {
  return async (req, res, next = () => {}) => {
    if (!req.url?.startsWith('/__market/')) return next()
    const origin = req.headers.origin
    const host = req.headers.host || ''
    if ((origin && origin !== `http://${host}`) || !/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host) || req.method !== 'GET') {
      res.writeHead(403); res.end('本地行情代理只接受同源 GET 请求'); return
    }
    let target
    try { target = marketTarget(req.url) } catch (error) { res.writeHead(400); res.end(error.message); return }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const closed = () => { if (!res.writableEnded) controller.abort() }
    res.once('close', closed)
    try {
      const response = await fetch(target, { redirect: 'error', signal: controller.signal, headers: { Referer: 'https://stockapp.finance.qq.com/', 'User-Agent': 'Mozilla/5.0 OTools-Stock/0.1.0' } })
      if (!response.ok) throw new Error(`行情服务 HTTP ${response.status}`)
      if (Number(response.headers.get('content-length') || 0) > MAX_MARKET_BYTES) throw new Error('行情响应过大')
      const reader = response.body.getReader(), chunks = []; let size = 0
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        size += value.length
        if (size > MAX_MARKET_BYTES) { await reader.cancel(); throw new Error('行情响应过大') }
        chunks.push(value)
      }
      res.writeHead(200, { 'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(Buffer.concat(chunks))
    } catch (error) {
      if (!res.destroyed) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(error.name === 'AbortError' ? '行情请求超时或取消' : '行情服务暂不可用') }
    } finally { clearTimeout(timer); res.off('close', closed) }
  }
}
export function marketProxyPlugin() {
  return { name: 'otools-stock-loopback-market', configureServer(server) { server.middlewares.use(marketProxy()) } }
}
