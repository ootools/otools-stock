<script setup lang="ts">
import { ref,computed,onMounted,onBeforeUnmount,watch } from 'vue'
import type { AlertRule,Instrument,MarketProvider,Trade } from './domain/types'
import { createStockDesk,type StockDesk } from './composables/useStockDesk'
import { createMarketProvider } from './services/market'
import { createPersistence } from './services/persistence'
import { playSound,sendAlertNotifications,saveTextFile } from './services/platform'
import { exportCsv } from './domain/snapshot'
import { INDEXES } from './domain/symbols'
import { number,percent,trendClass,localDate } from './domain/format'
import Icon from './components/Icon.vue'
import WatchlistView from './components/WatchlistView.vue'
import PortfolioView from './components/PortfolioView.vue'
import AlertsView from './components/AlertsView.vue'
import SettingsView from './components/SettingsView.vue'
import StockSearch from './components/StockSearch.vue'
import TradeDialog from './components/TradeDialog.vue'
import AlertDialog from './components/AlertDialog.vue'
const props=withDefaults(defineProps<{desk?:StockDesk;provider?:MarketProvider;autoStart?:boolean}>(),{autoStart:true})
const provider=props.provider||createMarketProvider(),toast=ref(''),notice=ref('')
let toastTimer:ReturnType<typeof setTimeout>|null=null
function showToast(message:string){toast.value=message;if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',5000)}
const desk=props.desk||createStockDesk({provider,persistence:createPersistence(),onAlert:async events=>{
 showToast(`${events.length} 条价格提醒已触发，可在提醒页查看`)
 try{if(desk.data.value.settings.sound)await playSound();if(desk.data.value.settings.notifications)await sendAlertNotifications(events,desk.data.value.instruments)}catch(e){notice.value=e instanceof Error?e.message:'系统通知不可用'}
}})
const data=computed(()=>desk.data.value),nav=ref<'watch'|'portfolio'|'alerts'|'settings'>('watch'),searchOpen=ref(false),searchGroup=ref<string|undefined>(),tradeOpen=ref(false),tradeInstrument=ref<Instrument|undefined>(),editingTrade=ref<Trade|undefined>(),alertOpen=ref(false),alertInstrument=ref<Instrument|undefined>(),editingAlert=ref<AlertRule|undefined>()
const pageTitles={watch:'自选盯盘',portfolio:'我的持仓',alerts:'价格提醒',settings:'设置与备份'}
const systemDark=ref(typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches!==false)
const theme=computed(()=>data.value.settings.theme==='system'?(systemDark.value?'dark':'light'):data.value.settings.theme)
const benchmark=computed(()=>INDEXES.map(instrument=>({instrument,quote:data.value.quoteCache[instrument.symbol]})))
const lastTime=computed(()=>desk.lastRefresh.value?new Date(desk.lastRefresh.value).toLocaleTimeString('zh-CN',{hour12:false}):'等待行情')
watch(theme,value=>{document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value},{immediate:true})
watch(()=>data.value.settings.colorScheme,value=>{document.documentElement.dataset.color=value},{immediate:true})
function openSearch(groupId?:string){searchGroup.value=groupId;searchOpen.value=true}
function openTrade(instrument?:Instrument,trade?:Trade){tradeInstrument.value=instrument;editingTrade.value=trade;tradeOpen.value=true}
function openAlert(instrument?:Instrument,rule?:AlertRule){alertInstrument.value=instrument;editingAlert.value=rule;alertOpen.value=true}
function addStock(instrument:Instrument,groupId:string){try{desk.addWatch(instrument,groupId);searchOpen.value=false;nav.value='watch';showToast(`${instrument.name} 已加入自选`);void desk.refresh().catch(()=>{})}catch(e){showToast(e instanceof Error?e.message:'添加失败')}}
async function refresh(){try{await desk.refresh()}catch{showToast('行情更新失败，已保留原有数据')}}
async function exportData(kind:'json'|'watch'|'portfolio'){
 try{
  let content:string,name:string,mime:string
  if(kind==='json'){content=JSON.stringify(data.value);name=`otools-stock-backup-${localDate()}.json`;mime='application/json'}
  else if(kind==='watch'){content=exportCsv(['股票名称','证券代码','币种','分组','现价','涨跌幅%','行情交易所时间'],data.value.watchlist.map(w=>{const stock=data.value.instruments[w.symbol]!,q=data.value.quoteCache[w.symbol];return [stock.name,w.symbol,stock.currency,data.value.groups.find(g=>g.id===w.groupId)?.name,q?.price,q?.changePercent,q?.exchangeTime]}));name=`otools-stock-watchlist-${localDate()}.csv`;mime='text/csv'}
  else{content=exportCsv(['股票名称','证券代码','币种','持股数量','成本金额','平均成本','现价','持股市值','浮动盈亏','行情日盈亏','已实现盈亏','行情交易所时间'],desk.portfolio.value.positions.map(p=>[p.instrument.name,p.instrument.symbol,p.instrument.currency,p.quantity,p.cost,p.averageCost,p.quote?.price,p.marketValue,p.unrealizedPnl,p.dayPnl,p.realizedPnl,p.quote?.exchangeTime]));name=`otools-stock-portfolio-${localDate()}.csv`;mime='text/csv'}
  if(await saveTextFile(content,name,mime))showToast('导出已完成；备份含私人持仓，请妥善保存')
 }catch(e){showToast(e instanceof Error?e.message:'导出失败')}
}
function shortcut(event:KeyboardEvent){if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch()}if(event.key==='Escape'&&!searchOpen.value&&!tradeOpen.value&&!alertOpen.value)toast.value=''}
const media=typeof window!=='undefined'?window.matchMedia?.('(prefers-color-scheme: dark)'):null
const mediaChange=(event:MediaQueryListEvent)=>systemDark.value=event.matches
onMounted(async()=>{document.addEventListener('keydown',shortcut);media?.addEventListener('change',mediaChange);if(props.autoStart)await desk.start();else await desk.initialize()})
onBeforeUnmount(()=>{document.removeEventListener('keydown',shortcut);media?.removeEventListener('change',mediaChange);if(toastTimer)clearTimeout(toastTimer);desk.dispose()})
</script>
<template><div class="stock-desk" :data-theme="theme">
 <aside class="app-sidebar"><a class="brand" href="#" aria-label="股票工作台首页" @click.prevent="nav='watch'"><span class="brand-icon"><Icon name="chart" :size="24"/></span><span class="brand-name">股票工作台<small>STOCK DESK</small></span></a><div class="sidebar-caption">投资工作台</div><nav class="app-nav" aria-label="主导航"><button data-testid="nav-watch" aria-label="自选盯盘" title="自选盯盘" :aria-current="nav==='watch'?'page':undefined" :class="{active:nav==='watch'}" @click="nav='watch'"><Icon name="grid"/><span>自选盯盘</span><b>{{data.watchlist.length}}</b></button><button data-testid="nav-portfolio" aria-label="我的持仓" title="我的持仓" :aria-current="nav==='portfolio'?'page':undefined" :class="{active:nav==='portfolio'}" @click="nav='portfolio'"><Icon name="wallet"/><span>我的持仓</span></button><button data-testid="nav-alerts" aria-label="价格提醒" title="价格提醒" :aria-current="nav==='alerts'?'page':undefined" :class="{active:nav==='alerts'}" @click="nav='alerts'"><Icon name="bell"/><span>价格提醒</span><i v-if="data.alerts.some(a=>a.enabled)" class="nav-dot"/></button><div class="nav-divider"/><button data-testid="nav-settings" aria-label="设置与备份" title="设置与备份" :aria-current="nav==='settings'?'page':undefined" :class="{active:nav==='settings'}" @click="nav='settings'"><Icon name="settings"/><span>设置与备份</span></button></nav><div class="sidebar-bottom"><div class="local-badge"><Icon name="shield" :size="15"/><span>持仓数据仅保存在本地</span></div><span class="sidebar-powered">POWERED BY OTOOLS</span></div></aside>
 <div class="app-body"><header class="app-topbar"><div class="breadcrumb"><span class="muted">工作台</span><Icon name="chevron" :size="12"/><strong>{{pageTitles[nav]}}</strong></div><div class="topbar-actions"><button class="global-search" aria-label="搜索并添加股票" @click="openSearch()"><Icon name="search" :size="16"/><span>搜索股票</span><kbd>⌘ K</kbd></button><button class="icon-button" :class="{spinning:desk.loading.value}" aria-label="手动刷新行情" :disabled="desk.loading.value" @click="refresh"><Icon name="refresh" :size="18"/></button><button class="icon-button" :aria-label="data.settings.refreshEnabled?'暂停自动刷新':'开启自动刷新'" @click="desk.updateSettings({refreshEnabled:!data.settings.refreshEnabled})"><Icon :name="data.settings.refreshEnabled?'pause':'play'" :size="17"/></button><span class="refresh-status"><i class="status-dot" :class="data.settings.refreshEnabled?'fresh':'stale'"/>{{data.settings.refreshEnabled?`${data.settings.refreshSeconds}s 自动刷新`:'已暂停'}}</span></div></header>
 <main class="app-main"><div v-if="desk.storageError.value" class="global-warning" role="alert"><Icon name="shield"/><div><strong>本地数据读取失败，已禁止写入以保护原始记录</strong><p>{{desk.storageError.value}}</p></div><button class="button subtle small" @click="nav='settings'">从备份恢复</button></div><div v-else-if="desk.saveError.value" class="global-warning" role="alert"><Icon name="info"/><span>数据尚未保存：{{desk.saveError.value}}。请导出备份或重试。</span><button class="text-button" @click="desk.retrySave()">重试保存</button></div>
 <div v-if="nav==='watch'" class="market-strip"><article v-for="index in benchmark" :key="index.instrument.symbol" class="index-card surface"><div class="index-name">{{index.instrument.name}}<span class="mono">{{index.instrument.code}}</span></div><div class="index-value"><strong class="mono" :class="trendClass(index.quote?.change)">{{number(index.quote?.price)}}</strong><span class="mono" :class="trendClass(index.quote?.changePercent)">{{percent(index.quote?.changePercent)}}</span></div><div class="index-caption"><i class="status-dot" :class="desk.quoteState(index.instrument.symbol)"/>{{index.quote?(desk.quoteState(index.instrument.symbol)==='fresh'?'最新行情':desk.quoteState(index.instrument.symbol)==='error'?'更新失败 · 旧行情':'快照 · 非实时'):'等待行情'}}</div></article></div>
 <div v-if="nav==='watch'" class="market-meta"><span><Icon name="clock" :size="13"/>{{lastTime}} 更新 <span class="source-separator">·</span> 腾讯财经公开行情</span><span class="muted">第三方数据可能延时 · 非交易终端</span></div>
 <div v-if="desk.marketError.value" class="market-notice" role="status"><Icon name="info" :size="14"/><span>{{desk.marketError.value}}</span><button class="text-button" @click="refresh">重试</button></div>
 <WatchlistView v-if="nav==='watch'" :desk="desk" :provider="provider" @add="openSearch" @trade="openTrade" @alert="openAlert" @toast="showToast"/>
 <PortfolioView v-else-if="nav==='portfolio'" :desk="desk" @trade="openTrade" @export="exportData('portfolio')" @toast="showToast"/>
 <AlertsView v-else-if="nav==='alerts'" :desk="desk" @add="openAlert(undefined,$event)"/>
 <SettingsView v-else :desk="desk" @export="exportData" @toast="showToast"/>
 <p v-if="notice" class="inline-notice">{{notice}}<button class="text-button" @click="notice=''">关闭</button></p>
 </main><footer class="app-footer"><span><span class="footer-dot"/> 本地工作台 · OTools</span><span>仅供参考，不构成投资建议</span></footer></div>
 <StockSearch v-if="searchOpen" :provider="provider" :groups="data.groups" :existing="data.watchlist.map(w=>w.symbol)" :default-group="searchGroup" @close="searchOpen=false" @add="addStock"/>
 <TradeDialog v-if="tradeOpen" :desk="desk" :instrument="tradeInstrument" :trade="editingTrade" @close="tradeOpen=false" @saved="showToast('交易已记录，成本与持股已重新计算')"/>
 <AlertDialog v-if="alertOpen" :desk="desk" :instrument="alertInstrument" :rule="editingAlert" @close="alertOpen=false" @saved="showToast('提醒规则已保存')"/>
 <Transition name="toast"><div v-if="toast" class="app-toast" role="status"><Icon name="check" :size="17"/><span>{{toast}}</span><button class="icon-button" aria-label="关闭提示" @click="toast='' "><Icon name="close" :size="14"/></button></div></Transition>
</div></template>
