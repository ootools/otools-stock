<script setup lang="ts">
import { ref,computed,watch,onBeforeUnmount } from 'vue'
import type { Group,Instrument,MarketProvider } from '../domain/types'
import { searchCatalog,normalizeSymbol,instrumentFromSymbol } from '../domain/symbols'
import BaseDialog from './BaseDialog.vue'
import Icon from './Icon.vue'
const props=defineProps<{provider:MarketProvider;groups:Group[];existing:string[];defaultGroup?:string}>()
const emit=defineEmits<{close:[];add:[instrument:Instrument,groupId:string]}>()
const query=ref(''),remote=ref<Instrument[]>([]),loading=ref(false),error=ref(''),groupId=ref(props.defaultGroup||props.groups[0]?.id||'')
let timer:ReturnType<typeof setTimeout>|null=null,controller:AbortController|null=null,generation=0
const results=computed(()=>{
 const local=searchCatalog(query.value),symbol=normalizeSymbol(query.value)
 const codeStock=symbol&&!local.some(i=>i.symbol===symbol)?[instrumentFromSymbol(symbol,symbol.slice(2))]:[]
 return [...new Map([...local,...remote.value,...codeStock].map(i=>[i.symbol,i])).values()].slice(0,20)
})
watch(query,()=>{
 generation++;const token=generation;controller?.abort();if(timer)clearTimeout(timer);remote.value=[];error.value='';loading.value=false
 if(!query.value.trim())return
 loading.value=true;timer=setTimeout(async()=>{
  controller=new AbortController();const signal=controller.signal
  try{const rows=await props.provider.search(query.value,signal);if(token===generation&&!signal.aborted)remote.value=rows}
  catch(e){if(token===generation&&!signal.aborted)error.value='在线搜索暂不可用，仍可使用本地目录或输入完整代码'}
  finally{if(token===generation)loading.value=false}
 },250)
})
onBeforeUnmount(()=>{generation++;controller?.abort();if(timer)clearTimeout(timer)})
</script>
<template><BaseDialog title="添加自选股票" subtitle="支持 A 股、港股与美股；名称、代码或拼音搜索" @close="emit('close')">
 <div class="search-dialog-content"><label class="search-field"><Icon name="search"/><input v-model="query" aria-label="搜索股票" placeholder="如：贵州茅台 / 600519 / AAPL" autocomplete="off" autofocus/><kbd>⌘ K</kbd></label>
 <div class="search-options"><span>{{loading?'在线搜索中…':'常用证券与搜索结果'}}</span><label>添加到 <select v-model="groupId" aria-label="自选分组"><option v-for="group in groups" :key="group.id" :value="group.id">{{group.name}}</option></select></label></div>
 <p v-if="error" class="inline-notice">{{error}}</p><div class="search-results"><div v-for="stock in results" :key="stock.symbol" class="search-result"><span class="market-tag" :class="stock.market.toLowerCase()">{{stock.market==='CN'?stock.symbol.slice(0,2).toUpperCase():stock.market}}</span><div class="search-stock-name"><strong>{{stock.name}}</strong><span class="mono">{{stock.code}} · {{stock.currency}}</span></div><button class="button small" :class="existing.includes(stock.symbol)?'subtle':'primary'" :aria-label="`添加 ${stock.name}`" @click="emit('add',stock,groupId)"><Icon :name="existing.includes(stock.symbol)?'check':'plus'" :size="14"/>{{existing.includes(stock.symbol)?'已自选':'添加'}}</button></div><div v-if="!results.length&&!loading" class="empty-state small"><p>未找到股票</p><span>试试完整代码，如 sh600519、hk00700 或 AAPL</span></div></div></div>
 </BaseDialog></template>
