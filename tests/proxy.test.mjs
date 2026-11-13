import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marketTarget } from '../scripts/market-proxy.mjs'
test('proxy builds only fixed HTTPS provider targets',()=>{
 assert.equal(marketTarget('/__market/quotes?symbols=sh600519,hk00700,usAAPL').href,'https://qt.gtimg.cn/q=sh600519,hk00700,usAAPL')
 assert.equal(marketTarget('/__market/search?q=%E8%8C%85%E5%8F%B0').hostname,'smartbox.gtimg.cn')
 assert.equal(marketTarget('/__market/chart?symbol=usAAPL.OQ&period=day').pathname,'/appstock/app/usfqkline/get')
})
test('preview proxy rejects arbitrary host, path, control characters and excessive batches',()=>{
 for(const path of ['https://evil.test','/__market/quotes?symbols=sh600519%26evil=1','/__market/chart?symbol=../../etc&period=day','/__market/chart?symbol=usAAPL&period=hack','/__market/search?q=%0d%0a','/__market/quotes?symbols=sh600519&url=https://evil.test','/__market/search?q='+ 'a'.repeat(81)])assert.throws(()=>marketTarget(path))
 assert.throws(()=>marketTarget('/__market/quotes?symbols='+Array(81).fill('sh600519').join(',')))
})

test('loopback proxy rejects non-GET, foreign Host and cross-origin requests before network', async()=>{
 const {marketProxy}=await import('../scripts/market-proxy.mjs')
 for(const req of [
  {url:'/__market/search?q=x',method:'POST',headers:{host:'127.0.0.1:6552'}},
  {url:'/__market/search?q=x',method:'GET',headers:{host:'evil.example:6552'}},
  {url:'/__market/search?q=x',method:'GET',headers:{host:'127.0.0.1:6552',origin:'https://evil.example'}},
 ]){
  let status=0,ended=false
  await marketProxy()(req,{writeHead(code){status=code},end(){ended=true}})
  assert.equal(status,403);assert.equal(ended,true)
 }
})

test('public K-line routes map all three markets and daily/weekly/monthly qfq parameters', () => {
 for (const symbol of ['sh600519', 'hk00700', 'usAAPL.OQ']) for (const period of ['day', 'week', 'month']) {
  const target = marketTarget(`/__market/chart?symbol=${symbol}&period=${period}`)
  assert.equal(target.protocol, 'https:')
  assert.equal(target.hostname, 'web.ifzq.gtimg.cn')
  assert.equal(target.pathname, `/appstock/app/${symbol.startsWith('us') ? 'usfqkline' : 'fqkline'}/get`)
  assert.equal(target.searchParams.get('param'), `${symbol},${period},,,120,qfq`)
 }
})
