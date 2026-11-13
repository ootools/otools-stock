import { describe,it,expect,vi,afterEach } from 'vitest'
import { mount,flushPromises,type VueWrapper } from '@vue/test-utils'
import { createStockDesk,type StockDesk } from '../src/composables/useStockDesk'
import { createDefaultData } from '../src/domain/snapshot'
import type { AppData,MarketProvider } from '../src/domain/types'
import AlertDialog from '../src/components/AlertDialog.vue'
import TradeDialog from '../src/components/TradeDialog.vue'
import StockDetail from '../src/components/StockDetail.vue'
import { now,quote,trade,maotai } from './fixtures/domain'
const desks:StockDesk[]=[],wrappers:VueWrapper[]=[]
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());desks.splice(0).forEach(d=>d.dispose());document.body.innerHTML='';vi.useRealTimers()})
const provider=():MarketProvider=>({quotes:vi.fn().mockResolvedValue([quote()]),chart:vi.fn().mockRejectedValue(new Error('暂无图表')),search:vi.fn().mockResolvedValue([])})
async function readyDesk(){const desk=createStockDesk({provider:provider(),persistence:{load:async()=>null,save:async()=>{}},now:()=>now});desks.push(desk);await desk.initialize();await desk.refresh();return desk}
function setInput(label:string,value:string,event='input'){const input=document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;input.value=value;input.dispatchEvent(new Event(event,{bubbles:true}));return flushPromises()}
describe('final review regressions',()=>{
 it('an obsolete initial load cannot overwrite a confirmed imported snapshot or its persisted trades',async()=>{
  let resolveLoad!:(value:AppData)=>void
  const writes:AppData[]=[],market=provider()
  const desk=createStockDesk({provider:market,persistence:{load:()=>new Promise(resolve=>{resolveLoad=resolve}),save:async snapshot=>{writes.push(snapshot)}},now:()=>now});desks.push(desk)
  const initial=desk.initialize(),restored=createDefaultData();restored.settings.refreshEnabled=false;restored.trades=[trade({id:'restored'})]
  desk.importData(restored);await desk.flush();resolveLoad(createDefaultData());await initial
  expect(desk.data.value.trades).toHaveLength(1);expect(desk.data.value.trades[0]!.id).toBe('restored')
  await desk.refresh();await desk.flush();expect(writes.at(-1)!.trades[0]!.id).toBe('restored')
 })
 it('an obsolete load error cannot re-lock successfully restored data',async()=>{
  let rejectLoad!:(error:Error)=>void
  const desk=createStockDesk({provider:provider(),persistence:{load:()=>new Promise((_r,reject)=>{rejectLoad=reject}),save:async()=>{}}});desks.push(desk)
  const initial=desk.initialize(),restored=createDefaultData();restored.settings.refreshEnabled=false;desk.importData(restored)
  rejectLoad(new Error('old read failed'));await initial
  expect(desk.canWrite.value).toBe(true);expect(desk.storageError.value).toBe('')
 })
 it('keeps a valid zero percent threshold unchanged when opening and saving the edit dialog',async()=>{
  const desk=await readyDesk(),id=desk.addAlert({symbol:'sh600519',metric:'changePercent',direction:'above',threshold:0,cooldownMinutes:5})
  const wrapper=mount(AlertDialog,{props:{desk,rule:desk.data.value.alerts[0]},attachTo:document.body});wrappers.push(wrapper);await flushPromises()
  const input=document.querySelector('input[aria-label="提醒阈值"]') as HTMLInputElement
  expect(input.value).toBe('0')
  document.querySelector('[role="dialog"] form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flushPromises()
  expect(desk.data.value.alerts.find(a=>a.id===id)!.threshold).toBe(0)
 })
 it('uses the selected metric as a threshold default rather than a price for percent',async()=>{
  const desk=await readyDesk();const wrapper=mount(AlertDialog,{props:{desk},attachTo:document.body});wrappers.push(wrapper);await flushPromises()
  await setInput('提醒指标','changePercent','change')
  expect((document.querySelector('input[aria-label="提醒阈值"]') as HTMLInputElement).value).toBe('9.09')
 })
 it('reinitializes a trade price when switching stock and clears it if that stock has no quote',async()=>{
  const desk=await readyDesk();const wrapper=mount(TradeDialog,{props:{desk,instrument:maotai},attachTo:document.body});wrappers.push(wrapper);await flushPromises()
  expect((document.querySelector('input[aria-label="成交价"]') as HTMLInputElement).value).toBe('120')
  await setInput('交易股票','hk00700','change')
  expect((document.querySelector('input[aria-label="成交价"]') as HTMLInputElement).value).toBe('')
  await setInput('交易股票','sh600519','change')
  expect((document.querySelector('input[aria-label="成交价"]') as HTMLInputElement).value).toBe('120')
 })
 it('expires rendered fresh labels while refresh is paused, without fetching new quotes',async()=>{
  vi.useFakeTimers();vi.setSystemTime(now)
  const market=provider(),desk=createStockDesk({provider:market,persistence:{load:async()=>null,save:async()=>{}},now:()=>Date.now()});desks.push(desk)
  await desk.start();await vi.advanceTimersByTimeAsync(0)
  desk.updateSettings({refreshEnabled:false})
  const wrapper=mount(StockDetail,{props:{desk,provider:market,instrument:maotai}});wrappers.push(wrapper);await vi.advanceTimersByTimeAsync(0)
  expect(wrapper.get('.quote-status').text()).toContain('行情已更新')
  const calls=vi.mocked(market.quotes).mock.calls.length
  await vi.advanceTimersByTimeAsync(6*60000)
  expect(wrapper.get('.quote-status').text()).not.toContain('行情已更新')
  expect(wrapper.find('.status-dot.fresh').exists()).toBe(false)
  expect(vi.mocked(market.quotes).mock.calls.length).toBe(calls)
 })
 it('disposing during initial load never restarts a poller or initiates provider requests',async()=>{
  vi.useFakeTimers()
  let resolveLoad!:(value:AppData)=>void
  const market=provider(),desk=createStockDesk({provider:market,persistence:{load:()=>new Promise(resolve=>{resolveLoad=resolve}),save:async()=>{}}});desks.push(desk)
  const starting=desk.start();desk.dispose();resolveLoad(createDefaultData());await starting
  await vi.advanceTimersByTimeAsync(60000)
  expect(market.quotes).not.toHaveBeenCalled()
 })
})
