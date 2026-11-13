// DOM integration of the exact shipped production bundle, not a real-browser/layout test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JSDOM,VirtualConsole } from 'jsdom'
import { marketTarget } from '../scripts/market-routes.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const built=existsSync(path.join(root,'dist/index.html'))
const waitFor=async (predicate,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,30))}throw new Error('Production DOM timeout')}
test('shipped bundle initializes host HTTP/state and the UI, keeps native plugin dispatch unused', {skip:!built,timeout:20000},async()=>{
 const html=readFileSync(path.join(root,'dist/index.html'),'utf8'),asset=html.match(/src="\.\/([^"\s]+\.js)"/)[1],code=readFileSync(path.join(root,'dist',asset),'utf8')
 const errors=[],commands=[],states=[]
 const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message))
 const current=new Date(),exchange=new Date(current.getTime()+8*3600000).toISOString().replace(/\D/g,'').slice(0,14)
 const fields=Array(88).fill('');Object.assign(fields,{0:'1',1:'贵州茅台',2:'600519',3:'120',4:'110',5:'115',6:'1000',30:exchange,31:'10',32:'9.09',33:'121',34:'109',36:'1000',37:'1200',38:'1',39:'20',45:'1000'})
 const quote=`v_sh600519="${fields.join('~')}";`
 const dom=new JSDOM(html,{url:'https://stock.local/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console})
 const w=dom.window;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}})
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{}
 w.otools={isDev:()=>false,getPluginLocalState:async()=>null,savePluginLocalState:async(_plugin,state)=>states.push(JSON.parse(JSON.stringify(state))),invokeNative(){throw new Error('Native plugin dispatch forbidden')},shellOpenExternal(){}}
 w.__TAURI_INTERNALS__={invoke:async(command,args)=>{
  commands.push(command);assert.equal(command,'otools_host_http_send');assert.match(args.request.url,/^https:\/\/(qt\.gtimg\.cn|web\.ifzq\.gtimg\.cn|smartbox\.gtimg\.cn)\//)
  const text=args.request.url.includes('qt.gtimg.cn')?quote:JSON.stringify({code:0,data:{sh600519:{data:{date:exchange.slice(0,8),data:['0930 115 100 1150000','0931 120 200 2350000']}}}})
  return {status:200,body_base64:Buffer.from(text).toString('base64')}
 }}
 try{
  w.eval(code)
  await waitFor(()=>w.document.querySelector('.detail-price')?.textContent.includes('120.00'))
  assert.match(w.document.body.textContent,/股票工作台/);assert.ok(commands.length>=2)
  w.document.querySelector('[data-testid="nav-portfolio"]').click();await waitFor(()=>w.document.body.textContent.includes('暂无持仓'))
  w.document.querySelector('[data-testid="add-trade"]').click();await waitFor(()=>w.document.querySelector('[role="dialog"]'))
  const set=(label,value,type='input')=>{const el=w.document.querySelector(`[aria-label="${label}"]`);el.value=value;el.dispatchEvent(new w.Event(type,{bubbles:true}))}
  set('交易类型','opening','change');set('数量','100');set('成交价','100');set('费用','5')
  w.document.querySelector('[role="dialog"] form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))
  await waitFor(()=>states.some(s=>s.trades.length===1));assert.equal(states.at(-1).trades[0].quantity,100)
  assert.match(w.document.body.textContent,/10,005\.00/)
  w.document.querySelector('[data-testid="nav-settings"]').click();await waitFor(()=>w.document.body.textContent.includes('数据备份'))
  assert.deepEqual(errors,[])
 }finally{dom.window.close()}
})
test('actual production provider endpoints produce live quote/chart DOM via preview-policy URLs', {skip:!built || process.env.OTOOLS_LIVE_DOM!=='1',timeout:30000},async()=>{
 const html=readFileSync(path.join(root,'dist/index.html'),'utf8'),asset=html.match(/src="\.\/([^"\s]+\.js)"/)[1],code=readFileSync(path.join(root,'dist',asset),'utf8')
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message))
 const dom=new JSDOM(html,{url:'http://127.0.0.1:6552/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console})
 const w=dom.window;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}})
 w.fetch=(url,options)=>fetch(marketTarget(url),{...options,signal:AbortSignal.timeout(12000),headers:{Referer:'https://stockapp.finance.qq.com/'}})
 try{w.eval(code);await waitFor(()=>w.document.querySelector('.detail-price .mono')?.textContent!=='—',20000);await waitFor(()=>w.document.querySelector('svg.stock-plot'),20000)
 assert.match(w.document.body.textContent,/腾讯财经/);assert.equal(w.document.querySelectorAll('.stock-table tbody tr').length,6);assert.ok(w.document.querySelector('svg.stock-plot .plot-price').getAttribute('d').length>100);assert.deepEqual(errors,[])
 process.stdout.write(`Production live DOM: ${w.document.querySelector('.detail-price .mono').textContent}, ${w.document.querySelectorAll('.stock-table tbody tr').length} watch stocks, real minute SVG path\n`)
 }finally{w.close()}
})
