import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marketProxy } from './market-proxy.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const index = process.argv.indexOf('--port'), port = Number(index >= 0 ? process.argv[index + 1] : 6552)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('无效预览端口')
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('请先运行 pnpm build')
const proxy = marketProxy()
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png' }
const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/__market/')) { await proxy(req,res); return }
  if (!['GET','HEAD'].includes(req.method || '')) { res.writeHead(405); res.end(); return }
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    const full = path.resolve(root, relative)
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); res.end('Not found'); return }
    res.writeHead(200,{ 'Content-Type':types[path.extname(full)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff' })
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(full).pipe(res)
  } catch { res.writeHead(400); res.end('Bad request') }
})
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(port,'127.0.0.1',()=>console.log(`OTools Stock preview: http://127.0.0.1:${port}`))
