import { describe, it, expect, vi } from 'vitest'
import { createStockDesk } from '../src/composables/useStockDesk'
import { createDefaultData } from '../src/domain/snapshot'
import { maotai, tencent, now, quote, trade } from './fixtures/domain'
import type { AppData, MarketProvider, Persistence } from '../src/domain/types'
function setup(data:unknown=null,save:Persistence['save']=vi.fn().mockResolvedValue(undefined),provider?: Partial<MarketProvider>){
 const market:MarketProvider={quotes:vi.fn().mockResolvedValue([quote()]),search:vi.fn().mockResolvedValue([]),chart:vi.fn(),...provider}
 return { desk:createStockDesk({provider:market,persistence:{load:vi.fn().mockResolvedValue(data),save},now:()=>now}),market,save }
}
describe('stock desk state',()=>{
 it('reads once, keeps quotes empty until fetched, and refreshes real requested securities',async()=>{
  const {desk,market}=setup();await desk.initialize()
  expect(desk.ready.value).toBe(true);expect(desk.data.value.quoteCache).toEqual({})
  await desk.refresh();expect(desk.data.value.quoteCache.sh600519!.price).toBe(120)
  expect(market.quotes).toHaveBeenCalledTimes(1)
  expect(desk.quoteState('sh600519')).toBe('fresh')
 })
 it('locks writes when loading corrupt storage instead of overwriting with defaults',async()=>{
  const {desk,save}=setup({version:99});await desk.initialize()
  expect(desk.storageError.value).not.toBe('');expect(desk.canWrite.value).toBe(false)
  expect(()=>desk.addTrade(trade())).toThrow(/存储|恢复/)
  await desk.refresh();await desk.flush()
  expect(save).not.toHaveBeenCalled()
 })
 it('atomically rejects oversell/edit/delete and preserves existing trades',async()=>{
  const {desk}=setup();await desk.initialize()
  const buy=trade({id:'buy'});desk.addTrade(buy)
  const sell=trade({id:'sell',type:'sell',quantity:50});desk.addTrade(sell)
  expect(()=>desk.updateTrade({...buy,quantity:40})).toThrow(/不足/)
  expect(()=>desk.deleteTrade('buy')).toThrow(/不足/)
  expect(desk.data.value.trades).toEqual([buy,sell])
 })
 it('removing a watch item preserves holdings and alert rules',async()=>{
  const {desk}=setup();await desk.initialize()
  desk.addTrade(trade());desk.addAlert({symbol:maotai.symbol,metric:'price',direction:'above',threshold:120,cooldownMinutes:5})
  desk.removeWatch(maotai.symbol)
  expect(desk.data.value.trades).toHaveLength(1);expect(desk.data.value.alerts).toHaveLength(1)
  await desk.refresh();expect(desk.data.value.alertEvents).toHaveLength(1)
 })
 it('keeps failed quotes cached and labels them error rather than fresh',async()=>{
  const initial=createDefaultData();initial.quoteCache.sh600519=quote()
  const {desk}=setup(initial,undefined,{quotes:vi.fn().mockRejectedValue(new Error('offline'))});await desk.initialize()
  expect(desk.quoteState('sh600519')).toBe('cached')
  await expect(desk.refresh()).rejects.toThrow('offline')
  expect(desk.data.value.quoteCache.sh600519!.price).toBe(120);expect(desk.quoteState('sh600519')).toBe('error')
 })
 it('marks individually omitted quotes unavailable even when the batch has other real prices',async()=>{
  const {desk}=setup();await desk.initialize();await desk.refresh()
  expect(desk.quoteState('hk00700')).toBe('unavailable')
 })
 it('serializes saves and ends with the latest snapshot without overtaking a slow save',async()=>{
  const resolvers:(()=>void)[]=[],writes:AppData[]=[]
  const save=vi.fn((data:AppData)=>{writes.push(data);return new Promise<void>(resolve=>resolvers.push(resolve))})
  const {desk}=setup(null,save);await desk.initialize()
  desk.addTrade(trade({id:'one'}));await Promise.resolve()
  desk.addTrade(trade({id:'two'}));expect(save).toHaveBeenCalledTimes(1)
  resolvers.shift()!();await new Promise(resolve=>setTimeout(resolve,0))
  expect(save).toHaveBeenCalledTimes(2);expect(writes[1]!.trades).toHaveLength(2)
  resolvers.shift()!();await desk.flush();expect(desk.unsaved.value).toBe(false)
 })
 it('warns when saving fails, preserving in-memory state for export and retry',async()=>{
  const {desk}=setup(null,vi.fn().mockRejectedValue(new Error('quota')));await desk.initialize()
  desk.addTrade(trade());await desk.flush()
  expect(desk.unsaved.value).toBe(true);expect(desk.saveError.value).toContain('quota');expect(desk.data.value.trades).toHaveLength(1)
 })
 it('requires a valid full snapshot for import; import cancels an old quote response',async()=>{
  let resolve!:(quotes:ReturnType<typeof quote>[])=>void
  const {desk}=setup(null,undefined,{quotes:vi.fn(()=>new Promise<ReturnType<typeof quote>[]>(r=>{resolve=r}))});await desk.initialize()
  const refresh=desk.refresh()
  const imported=createDefaultData();imported.watchlist=[];imported.quoteCache={}
  desk.importData(imported);resolve([quote()]);await refresh
  expect(desk.data.value.quoteCache).toEqual({})
  expect(()=>desk.importData({version:1} as AppData)).toThrow()
 })
 it('group deletion moves watches to a remaining group and cannot remove the last group',async()=>{
  const {desk}=setup();await desk.initialize();desk.deleteGroup('default')
  expect(desk.data.value.watchlist.every(w=>w.groupId==='focus')).toBe(true)
  expect(()=>desk.deleteGroup('focus')).toThrow(/至少/)
  desk.addWatch(tencent,'focus');expect(desk.data.value.watchlist.filter(w=>w.symbol==='hk00700')).toHaveLength(1)
 })
})

it('drains a queued latest save when the component is disposed during an older save',async()=>{
 const resolvers:(()=>void)[]=[],writes:AppData[]=[]
 const {desk}=setup(null,vi.fn((snapshot:AppData)=>{writes.push(snapshot);return new Promise<void>(resolve=>resolvers.push(resolve))}))
 await desk.initialize();desk.addTrade(trade({id:'one'}));desk.addTrade(trade({id:'two'}));desk.dispose()
 resolvers.shift()!();await new Promise(resolve=>setTimeout(resolve,0))
 if(writes.length<2)throw new Error('Latest queued trade snapshot was not saved after component disposal')
 expect(writes).toHaveLength(2);expect(writes[1]!.trades).toHaveLength(2)
 resolvers.shift()!();await desk.flush();expect(desk.unsaved.value).toBe(false)
})
it('syncs imported refresh settings with the running scheduler',async()=>{
 const {desk}=setup();await desk.initialize()
 const stop=vi.spyOn(desk.poller,'stop'),start=vi.spyOn(desk.poller,'start')
 const restored=createDefaultData();restored.settings.refreshEnabled=false;desk.importData(restored)
 expect(stop).toHaveBeenCalled()
 restored.settings.refreshEnabled=true;desk.importData(restored)
 expect(start).toHaveBeenCalled()
 desk.dispose()
})
it('includes recently fully sold stocks in refresh so their sale-day P&L remains updated',async()=>{
 const {desk,market}=setup();await desk.initialize()
 desk.addTrade(trade({id:'opening',symbol:'hk00700',type:'opening',quantity:10,date:'2026-11-12'}))
 desk.addTrade(trade({id:'sold',symbol:'hk00700',type:'sell',quantity:10,date:'2026-11-13'}))
 desk.removeWatch('hk00700');await desk.refresh()
 expect((market.quotes as ReturnType<typeof vi.fn>).mock.calls[0]![0].some((i:typeof tencent)=>i.symbol==='hk00700')).toBe(true)
 desk.dispose()
})

it('does not forget the already-consumed quote timestamp on toggling or editing a rule',async()=>{
 const {desk}=setup();await desk.initialize()
 const id=desk.addAlert({symbol:'sh600519',metric:'price',direction:'above',threshold:120,cooldownMinutes:1})
 await desk.refresh();expect(desk.data.value.alertEvents).toHaveLength(1)
 desk.toggleAlert(id);desk.toggleAlert(id)
 expect(desk.data.value.alerts[0]!.lastQuoteAt).toBe(now)
 desk.updateAlert({id,symbol:'sh600519',metric:'price',direction:'above',threshold:119,cooldownMinutes:1})
 expect(desk.data.value.alerts[0]!.lastQuoteAt).toBe(now)
 await desk.refresh();expect(desk.data.value.alertEvents).toHaveLength(1);desk.dispose()
})
