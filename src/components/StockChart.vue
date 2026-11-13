<script setup lang="ts">
import { ref,computed,watch,onBeforeUnmount } from 'vue'
import type { ChartData,ChartPeriod,Instrument,MarketProvider } from '../domain/types'
import { buildChartGeometry,movingAverage } from '../domain/chart'
import { number,amount,trendClass } from '../domain/format'
import Icon from './Icon.vue'
const props=withDefaults(defineProps<{instrument:Instrument;provider:MarketProvider;refreshToken:number;initialPeriod?:ChartPeriod}>(),{initialPeriod:'minute'})
const period=ref<ChartPeriod>(props.initialPeriod),chart=ref<ChartData|null>(null),loading=ref(false),error=ref(''),hover=ref<number|null>(null),showMA=ref(true)
const periods:{id:ChartPeriod;label:string}[]=[{id:'minute',label:'分时'},{id:'day',label:'日 K'},{id:'week',label:'周 K'},{id:'month',label:'月 K'}]
let controller:AbortController|null=null,generation=0
async function load(){
 const current=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal
 loading.value=true;error.value='';hover.value=null;chart.value=null
 try{const result=await props.provider.chart(props.instrument,period.value,signal);if(current!==generation||signal.aborted)return;chart.value=result}
 catch(e){if(current===generation&&!signal.aborted)error.value=e instanceof Error?e.message:'图表加载失败'}
 finally{if(current===generation)loading.value=false}
}
watch(()=>[props.instrument.symbol,period.value,props.refreshToken],load,{immediate:true})
onBeforeUnmount(()=>{generation++;controller?.abort()})
const geometry=computed(()=>buildChartGeometry(chart.value?.points||[],period.value==='minute'))
const selected=computed(()=>{const points=chart.value?.points||[];return points[hover.value??points.length-1]})
const selectedMA=computed(()=>[5,10,20].map(period=>({period,value:chart.value?movingAverage(chart.value.points,period)[hover.value??chart.value.points.length-1]:null})))
function pointer(event:PointerEvent){const rect=(event.currentTarget as SVGSVGElement).getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*650;hover.value=Math.max(0,Math.min(geometry.value.candles.length-1,Math.floor((x-geometry.value.left)/(geometry.value.right-geometry.value.left)*geometry.value.candles.length)))}
function keyboard(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const count=chart.value?.points.length||0;hover.value=Math.max(0,Math.min(count-1,(hover.value??count-1)+(event.key==='ArrowLeft'?-1:1)))}
</script>
<template>
 <section class="chart-section" aria-label="股票行情图表">
  <div class="chart-toolbar"><div class="segmented"><button v-for="item in periods" :key="item.id" :class="{active:period===item.id}" :aria-pressed="period===item.id" @click="period=item.id">{{item.label}}</button></div><label v-if="period!=='minute'" class="chart-ma-toggle"><input v-model="showMA" type="checkbox"/>均线</label><span v-else class="chart-legend"><i class="legend-dot average"/>均价</span></div>
  <div v-if="loading" class="chart-state"><div class="chart-skeleton"/><span><Icon name="refresh"/>正在加载真实行情…</span></div>
  <div v-else-if="error||!chart" class="chart-state empty"><Icon name="chart" :size="32"/><p>{{error||'暂无图表行情'}}</p><button class="text-button" @click="load">重新加载</button></div>
  <template v-else>
   <div class="chart-context mono"><span>{{selected?.time}}</span><template v-if="period==='minute'"><span :class="trendClass((selected?.close||0)-(chart.points[0]?.close||0))">价格 {{number(selected?.close)}}</span><span class="ma-5">均价 {{number(selected?.average)}}</span></template><template v-else><span>开 {{number(selected?.open)}}</span><span>收 {{number(selected?.close)}}</span><span>高 {{number(selected?.high)}}</span><span>低 {{number(selected?.low)}}</span></template><span>量 {{amount(selected?.volume)}}股</span></div>
   <div v-if="period!=='minute'&&showMA" class="ma-legend mono"><span v-for="ma in selectedMA" :key="ma.period" :class="`ma-${ma.period}`">MA{{ma.period}} {{number(ma.value)}}</span></div>
   <svg class="stock-plot" viewBox="0 0 650 326" role="img" tabindex="0" :aria-label="`${instrument.name}${period==='minute'?'分时':'K线'}，${chart.points.length}个真实数据点，左右键查看`" @pointermove="pointer" @pointerleave="hover=null" @keydown="keyboard">
    <defs><linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <g v-for="(tick,i) in geometry.ticks" :key="i"><line :x1="geometry.left" :x2="geometry.right" :y1="tick.y" :y2="tick.y" class="plot-grid"/><text x="589" :y="tick.y+4" class="plot-label">{{number(tick.value)}}</text></g>
    <template v-if="period==='minute'"><path :d="geometry.areaPath" fill="url(#price-area)"/><path :d="geometry.linePath" class="plot-price"/><path :d="geometry.averagePath" class="plot-average"/></template>
    <template v-else><g v-for="(candle,i) in geometry.candles" :key="i" :data-candle="i" :class="candle.up?'candle-up':'candle-down'"><line :x1="candle.x" :x2="candle.x" :y1="candle.highY" :y2="candle.lowY"/><rect :x="candle.x-candle.width/2" :y="candle.y" :width="candle.width" :height="candle.height"/></g><template v-if="showMA"><path v-for="ma in geometry.maPaths" :key="ma.period" :d="ma.path" :class="`plot-ma ma-${ma.period}`"/></template></template>
    <line :x1="geometry.left" :x2="geometry.right" y1="244" y2="244" class="plot-grid"/><text x="12" y="240" class="plot-label">成交量</text>
    <rect v-for="(candle,i) in geometry.candles" :key="`vol-${i}`" :x="candle.x-candle.width/2" :y="candle.volumeY" :width="candle.width" :height="candle.volumeHeight" :class="candle.up?'volume-up':'volume-down'"/>
    <g v-for="(tick,i) in geometry.timeTicks" :key="`time-${i}`"><text :x="tick.x" y="316" :text-anchor="i===0?'start':i===geometry.timeTicks.length-1?'end':'middle'" class="plot-label">{{tick.label}}</text></g>
    <g v-if="hover!==null&&geometry.candles[hover]"><line :x1="geometry.candles[hover]!.x" :x2="geometry.candles[hover]!.x" :y1="geometry.top" :y2="geometry.volumeBottom" class="plot-crosshair"/><circle :cx="geometry.candles[hover]!.x" :cy="geometry.candles[hover]!.y" r="3" class="plot-hover"/></g>
   </svg>
   <div class="chart-source"><span>{{chart.source}} · {{chart.adjustment}}</span><span>{{chart.points.length}} 个数据点</span></div>
  </template>
 </section>
</template>
