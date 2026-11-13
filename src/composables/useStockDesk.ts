import { computed, ref, shallowRef } from 'vue'
import type { AlertEvent, AlertRule, AppData, Instrument, MarketProvider, Persistence, Quote, Settings, Trade } from '../domain/types'
import { createDefaultData, validateInstrument, validateQuote, validateSnapshot } from '../domain/snapshot'
import { buildPortfolio } from '../domain/portfolio'
import { evaluateAlerts, quoteFresh } from '../domain/alerts'
import { INDEXES } from '../domain/symbols'
import { createPoller } from '../services/poller'

export interface DeskOptions { provider: MarketProvider; persistence: Persistence; now?: () => number; onAlert?: (events: AlertEvent[]) => void | Promise<void> }
export type QuoteState = 'fresh' | 'stale' | 'cached' | 'error' | 'unavailable'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)
const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`
const clone = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData

export function createStockDesk(options: DeskOptions) {
  const now = options.now || Date.now
  const data = shallowRef<AppData>(createDefaultData())
  const ready = ref(false), storageError = ref(''), saveError = ref(''), unsaved = ref(false), saving = ref(false)
  const loading = ref(false), marketError = ref(''), lastRefresh = ref<number | null>(null), selectedSymbol = ref(data.value.watchlist[0]?.symbol || 'sh600519')
  const quoteStates = ref<Record<string, QuoteState>>({})
  const clock=ref(now());let clockTimer:ReturnType<typeof setInterval>|null=null
  const ensureClock=()=>{if(clockTimer===null&&!disposed)clockTimer=setInterval(()=>{clock.value=now()},10000)}
  const canWrite = computed(() => ready.value && !storageError.value)
  const portfolio = computed(() => buildPortfolio(data.value.trades,data.value.instruments,data.value.quoteCache))
  let loadPromise: Promise<void> | null = null, savePromise: Promise<void> | null = null, queuedSave: AppData | null = null
  let generation = 0, disposed = false, epoch = 0, refreshPromise: Promise<void> | null = null, refreshController: AbortController | null = null

  function queueSave() {
    if (!canWrite.value) return
    unsaved.value = true; queuedSave = clone(data.value)
    if (savePromise) return
    saving.value = true
    const drain = async () => {
      while (queuedSave) {
        const snapshot = queuedSave; queuedSave = null
        try {
          await options.persistence.save(snapshot)
          saveError.value = ''
          if (!queuedSave) unsaved.value = false
        } catch (error) {
          saveError.value = errorMessage(error); unsaved.value = true
          // Preserve the newest memory snapshot; explicit retry or next edit will save again.
          queuedSave = null
          break
        }
      }
    }
    savePromise = drain().finally(() => { saving.value = false; savePromise = null; if (queuedSave) queueSave() })
  }
  function commit(next: AppData, recovery = false) {
    if (!recovery && !canWrite.value) throw new Error('本地存储尚未准备好或损坏，请先恢复备份')
    const valid = validateSnapshot(next)
    data.value = valid
    if (recovery) { storageError.value = ''; ready.value = true }
    queueSave()
  }
  function mutate(update: (next: AppData) => void) { const next = clone(data.value); update(next); commit(next) }
  async function initialize() {
    if (loadPromise) return loadPromise
    const loadGeneration=generation
    loadPromise = (async () => {
      try {
        const loaded = await options.persistence.load()
        if(loadGeneration!==generation||disposed)return
        data.value = loaded === null || loaded === undefined ? createDefaultData() : validateSnapshot(loaded)
        selectedSymbol.value = data.value.watchlist[0]?.symbol || Object.keys(data.value.instruments)[0] || ''
        quoteStates.value = Object.fromEntries(Object.keys(data.value.quoteCache).map(symbol => [symbol,'cached' as QuoteState]))
      } catch (error) { if(loadGeneration===generation&&!disposed)storageError.value = errorMessage(error) }
      finally { if(loadGeneration===generation&&!disposed)ready.value = true }
    })()
    return loadPromise
  }
  function requestedInstruments(): Instrument[] {
    const active = portfolio.value.positions.filter(p => p.quantity > 0).map(p => p.instrument.symbol)
    const recentSales=data.value.trades.filter(t=>t.type==='sell' && t.date>=new Date(now()-7*86400000).toISOString().slice(0,10)).map(t=>t.symbol)
    const symbols = new Set([...data.value.watchlist.map(w=>w.symbol),...active,...recentSales,...data.value.alerts.filter(a=>a.enabled).map(a=>a.symbol),...INDEXES.map(i=>i.symbol),selectedSymbol.value].filter(Boolean))
    return [...symbols].map(symbol => data.value.instruments[symbol] || INDEXES.find(i=>i.symbol===symbol)).filter((s):s is Instrument=>!!s)
  }
  function refresh(externalSignal?: AbortSignal): Promise<void> {
    if(disposed)return Promise.resolve()
    clock.value=now();ensureClock()
    if (refreshPromise) return refreshPromise
    refreshController = new AbortController()
    const signal = refreshController.signal, abort = () => refreshController?.abort()
    if (externalSignal?.aborted) refreshController.abort()
    externalSignal?.addEventListener('abort',abort,{once:true})
    const currentGeneration = generation, requested = requestedInstruments()
    loading.value = true
    refreshPromise = (async () => {
      try {
        const rows = await options.provider.quotes(requested,signal)
        if (signal.aborted || currentGeneration !== generation || disposed) return
        const next = clone(data.value), freshQuotes: Record<string, Quote> = {}
        const received = new Set<string>()
        for (const row of rows) {
          const instrument = requested.find(i=>i.symbol===row.symbol)
          if (!instrument) continue
          if (!next.instruments[row.symbol]) next.instruments[row.symbol] = instrument
          const q = validateQuote(row,row.symbol)
          if (next.quoteCache[row.symbol] && next.quoteCache[row.symbol]!.timestamp > q.timestamp) {
            quoteStates.value[row.symbol] = 'stale'; received.add(row.symbol); continue
          }
          next.quoteCache[row.symbol] = q; freshQuotes[row.symbol] = q; received.add(row.symbol)
          quoteStates.value[row.symbol] = quoteFresh(q,instrument,now()) ? 'fresh' : 'stale'
        }
        for (const instrument of requested) if (!received.has(instrument.symbol)) quoteStates.value[instrument.symbol] = next.quoteCache[instrument.symbol] ? 'error' : 'unavailable'
        const result = canWrite.value ? evaluateAlerts(next.alerts,freshQuotes,next.instruments,now()) : {rules:next.alerts,events:[]}
        next.alerts=result.rules;next.alertEvents=[...result.events,...next.alertEvents].slice(0,200)
        data.value=validateSnapshot(next)
        marketError.value=received.size<requested.length ? `${requested.length-received.size} 只证券暂无有效行情，其他行情已更新` : ''
        lastRefresh.value=now()
        if (canWrite.value) queueSave()
        if (result.events.length) {
          try { await options.onAlert?.(result.events) } catch { /* Platform errors are handled by its status UI; the trigger log persists. */ }
        }
      } catch (error) {
        if (signal.aborted || currentGeneration!==generation || disposed) return
        marketError.value=errorMessage(error)
        for (const i of requested) quoteStates.value[i.symbol]=data.value.quoteCache[i.symbol]?'error':'unavailable'
        throw error
      } finally { externalSignal?.removeEventListener('abort',abort); loading.value=false; refreshPromise=null }
    })()
    return refreshPromise
  }
  const poller=createPoller(async signal=>{ if(!ready.value)await initialize(); if(disposed)return; if(data.value.settings.pauseWhenHidden && typeof document!=='undefined' && document.hidden)return; await refresh(signal) },()=>data.value.settings.refreshSeconds*1000)
  function quoteState(symbol: string): QuoteState {
    const state=quoteStates.value[symbol] || (data.value.quoteCache[symbol]?'cached':'unavailable')
    const quote=data.value.quoteCache[symbol],stock=data.value.instruments[symbol]
    return state==='fresh' && quote && stock && !quoteFresh(quote,stock,Math.max(clock.value,now())) ? 'stale' : state
  }
  function addWatch(instrument: Instrument, groupId = data.value.groups[0]!.id) {
    const valid=validateInstrument(instrument)
    mutate(next=>{ next.instruments[valid.symbol]=valid;const current=next.watchlist.find(w=>w.symbol===valid.symbol);if(current)current.groupId=groupId;else next.watchlist.push({symbol:valid.symbol,groupId,pinned:false}) })
    selectedSymbol.value=valid.symbol
  }
  function removeWatch(symbol: string) { mutate(next=>{ next.watchlist=next.watchlist.filter(w=>w.symbol!==symbol) }) }
  function pinWatch(symbol: string) { mutate(next=>{ const w=next.watchlist.find(w=>w.symbol===symbol);if(w)w.pinned=!w.pinned }) }
  function moveWatch(symbol: string, direction: -1|1) {
    mutate(next=>{
      const index=next.watchlist.findIndex(w=>w.symbol===symbol);if(index<0)return
      const current=next.watchlist[index]!;let other=index+direction
      while(other>=0 && other<next.watchlist.length && next.watchlist[other]!.groupId!==current.groupId)other+=direction
      if(other>=0 && other<next.watchlist.length)[next.watchlist[index],next.watchlist[other]]=[next.watchlist[other]!,current]
    })
  }
  function moveToGroup(symbol: string,groupId:string){mutate(next=>{const w=next.watchlist.find(w=>w.symbol===symbol);if(w)w.groupId=groupId})}
  function addGroup(name: string) { const id=newId('group');mutate(next=>next.groups.push({id,name:name.trim()}));return id }
  function renameGroup(id:string,name:string){mutate(next=>{const g=next.groups.find(g=>g.id===id);if(!g)throw new Error('分组不存在');g.name=name.trim()})}
  function deleteGroup(id:string){mutate(next=>{if(next.groups.length<=1)throw new Error('至少保留一个自选分组');next.groups=next.groups.filter(g=>g.id!==id);for(const w of next.watchlist)if(w.groupId===id)w.groupId=next.groups[0]!.id})}
  function addTrade(trade:Trade,instrument?:Instrument){mutate(next=>{if(instrument)next.instruments[instrument.symbol]=validateInstrument(instrument);next.trades.push({...trade})})}
  function updateTrade(trade:Trade){mutate(next=>{const index=next.trades.findIndex(t=>t.id===trade.id);if(index<0)throw new Error('交易不存在');next.trades[index]={...trade}})}
  function deleteTrade(id:string){mutate(next=>{next.trades=next.trades.filter(t=>t.id!==id)})}
  type NewAlert=Pick<AlertRule,'symbol'|'metric'|'direction'|'threshold'|'cooldownMinutes'>
  function addAlert(rule:NewAlert){const id=newId('alert');mutate(next=>next.alerts.push({...rule,id,enabled:true,armed:true,lastQuoteAt:null,lastTriggeredAt:null}));return id}
  function updateAlert(rule:NewAlert & {id:string}){mutate(next=>{const index=next.alerts.findIndex(a=>a.id===rule.id);if(index<0)throw new Error('提醒不存在');next.alerts[index]={...next.alerts[index]!,...rule,armed:true,lastQuoteAt:next.alerts[index]!.symbol===rule.symbol?next.alerts[index]!.lastQuoteAt:null}})}
  function toggleAlert(id:string){mutate(next=>{const a=next.alerts.find(a=>a.id===id);if(a){a.enabled=!a.enabled;if(a.enabled)a.armed=true}})}
  function deleteAlert(id:string){mutate(next=>{next.alerts=next.alerts.filter(a=>a.id!==id)})}
  function clearAlertEvents(){mutate(next=>{next.alertEvents=[]})}
  function updateSettings(patch:Partial<Settings>){mutate(next=>{next.settings={...next.settings,...patch}});if(data.value.settings.refreshEnabled)poller.start();else poller.stop();poller.reschedule()}
  function importData(value: AppData){const valid=validateSnapshot(value);generation++;epoch++;refreshController?.abort();commit(valid,true);quoteStates.value=Object.fromEntries(Object.keys(valid.quoteCache).map(s=>[s,'cached' as QuoteState]));selectedSymbol.value=valid.watchlist[0]?.symbol || '';marketError.value='';lastRefresh.value=null;clock.value=now();ensureClock();if(!disposed&&valid.settings.refreshEnabled)poller.start();else poller.stop();poller.reschedule()}
  async function flush(){while(savePromise)await savePromise}
  function retrySave(){queueSave()}
  function select(symbol:string){if(data.value.instruments[symbol])selectedSymbol.value=symbol}
  async function start(){await initialize();if(disposed)return;ensureClock();if(data.value.settings.refreshEnabled)poller.start()}
  function dispose(){disposed=true;generation++;poller.stop();refreshController?.abort();if(clockTimer!==null){clearInterval(clockTimer);clockTimer=null}}
  return {data,ready,canWrite,storageError,saveError,unsaved,saving,loading,marketError,lastRefresh,selectedSymbol,portfolio,initialize,refresh,start,dispose,quoteState,addWatch,removeWatch,pinWatch,moveWatch,moveToGroup,addGroup,renameGroup,deleteGroup,addTrade,updateTrade,deleteTrade,addAlert,updateAlert,toggleAlert,deleteAlert,clearAlertEvents,updateSettings,importData,flush,retrySave,select,poller,newId,get epoch(){return epoch}}
}
export type StockDesk = ReturnType<typeof createStockDesk>
