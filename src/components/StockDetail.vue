<script setup lang="ts">
import { computed } from 'vue'
import type { Instrument,MarketProvider } from '../domain/types'
import type { StockDesk } from '../composables/useStockDesk'
import { number,percent,signed,amount,trendClass,currencySymbol,timeLabel } from '../domain/format'
import { openExternal } from '../services/platform'
import StockChart from './StockChart.vue'
import Icon from './Icon.vue'
const props=defineProps<{instrument:Instrument;desk:StockDesk;provider:MarketProvider}>(),emit=defineEmits<{trade:[instrument:Instrument];alert:[instrument:Instrument]}>()
const quote=computed(()=>props.desk.data.value.quoteCache[props.instrument.symbol]),state=computed(()=>props.desk.quoteState(props.instrument.symbol)),labels={fresh:'行情已更新',stale:'收盘 / 延时快照',cached:'上次缓存',error:'更新失败 · 旧行情',unavailable:'暂无行情'}
const watched=computed(()=>props.desk.data.value.watchlist.some(w=>w.symbol===props.instrument.symbol))
const stats=computed(()=>[
 ['今开',number(quote.value?.open)],['最高',number(quote.value?.high)],['成交量',`${amount(quote.value?.volume)}股`],
 ['昨收',number(quote.value?.previousClose)],['最低',number(quote.value?.low)],['成交额',amount(quote.value?.amount)],
 ['换手率',quote.value?.turnover==null?'—':`${number(quote.value.turnover)}%`],['市盈率',number(quote.value?.pe)],['总市值',amount(quote.value?.marketCap)],
])
function external(){openExternal(`https://gu.qq.com/${props.instrument.symbol}`)}
</script>
<template><aside class="detail-panel surface" aria-label="股票详情">
 <div class="detail-heading"><div><div class="eyebrow">STOCK OVERVIEW</div><h2>{{instrument.name}}<span class="market-tag" :class="instrument.market.toLowerCase()">{{instrument.market==='CN'?instrument.symbol.slice(0,2).toUpperCase():instrument.market}}</span></h2><div class="detail-code mono">{{instrument.code}} <span>· {{instrument.currency}}</span></div></div><button class="icon-button" :aria-label="`打开${instrument.name}行情网页`" @click="external"><Icon name="external" :size="17"/></button></div>
 <div class="detail-price"><strong class="mono" :class="trendClass(quote?.change)">{{number(quote?.price,instrument.market==='HK'?3:2)}}</strong><span class="detail-currency">{{currencySymbol(instrument.currency)}}</span><div class="price-changes mono" :class="trendClass(quote?.change)"><span>{{signed(quote?.change)}}</span><span class="percent-pill">{{percent(quote?.changePercent)}}</span></div></div>
 <div class="quote-status"><span class="status-dot" :class="state"/>{{labels[state]}}<span v-if="quote?.delayed" class="delayed-badge">可能延时</span><span class="quote-time mono">{{quote?timeLabel(quote.exchangeTime):'等待数据源'}}</span></div>
 <div class="quote-stats"><div v-for="[label,value] in stats" :key="label"><span>{{label}}</span><strong class="mono">{{value}}</strong></div></div>
 <StockChart :instrument="instrument" :provider="provider" :refresh-token="desk.lastRefresh.value||0"/>
 <div v-if="quote?.asks.length||quote?.bids.length" class="orderbook"><div class="orderbook-heading"><span>五档盘口</span><span class="muted">委托量 · 股</span></div><div class="orderbook-columns"><div><div v-for="(level,i) in quote.asks.slice().reverse()" :key="i" class="book-row"><span class="down">卖 {{quote.asks.length-i}}</span><strong class="mono">{{number(level.price)}}</strong><span class="mono muted">{{amount(level.quantity)}}</span></div></div><div><div v-for="(level,i) in quote.bids" :key="i" class="book-row"><span class="up">买 {{i+1}}</span><strong class="mono">{{number(level.price)}}</strong><span class="mono muted">{{amount(level.quantity)}}</span></div></div></div></div>
 <div class="detail-actions"><button class="button subtle" @click="emit('alert',instrument)"><Icon name="bell" :size="16"/>价格提醒</button><button v-if="instrument.kind==='stock'" class="button primary" @click="emit('trade',instrument)"><Icon name="wallet" :size="16"/>记录持股</button><button v-if="!watched" class="button subtle" @click="desk.addWatch(instrument)"><Icon name="plus" :size="16"/>加自选</button></div>
</aside></template>
