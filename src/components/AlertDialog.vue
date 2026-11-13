<script setup lang="ts">
import { ref,computed,watch } from 'vue'
import type { AlertMetric,AlertRule,Instrument } from '../domain/types'
import type { StockDesk } from '../composables/useStockDesk'
import { number } from '../domain/format'
import BaseDialog from './BaseDialog.vue'
import Icon from './Icon.vue'
const props=defineProps<{desk:StockDesk;instrument?:Instrument;rule?:AlertRule}>(),emit=defineEmits<{close:[];saved:[]}>()
const symbol=ref(props.rule?.symbol||props.instrument?.symbol||props.desk.selectedSymbol.value),metric=ref<AlertMetric>(props.rule?.metric||'price'),direction=ref<'above'|'below'>(props.rule?.direction||'above'),threshold=ref(String(props.rule?.threshold??props.desk.data.value.quoteCache[symbol.value]?.[metric.value]??'')),cooldown=ref(String(props.rule?.cooldownMinutes||5)),error=ref('')
watch([symbol,metric],()=>{threshold.value=String(props.desk.data.value.quoteCache[symbol.value]?.[metric.value]??'')})
const stocks=computed(()=>Object.values(props.desk.data.value.instruments)),quote=computed(()=>props.desk.data.value.quoteCache[symbol.value])
function submit(){error.value='';try{const rule={symbol:symbol.value,metric:metric.value,direction:direction.value,threshold:Number(threshold.value),cooldownMinutes:Number(cooldown.value)};if(props.rule)props.desk.updateAlert({...rule,id:props.rule.id});else props.desk.addAlert(rule);emit('saved');emit('close')}catch(e){error.value=e instanceof Error?e.message:'提醒规则无效'}}
</script>
<template><BaseDialog :title="rule?'编辑价格提醒':'新建价格提醒'" subtitle="跨过设定阈值时提醒；需保持插件运行与行情刷新" @close="emit('close')"><form class="dialog-form" @submit.prevent="submit">
 <label class="form-label">监控股票<select v-model="symbol" aria-label="提醒股票"><option v-for="stock in stocks" :key="stock.symbol" :value="stock.symbol">{{stock.name}} · {{stock.code}}</option></select></label>
 <div class="form-row"><label class="form-label">提醒指标<select v-model="metric" aria-label="提醒指标"><option value="price">股票价格</option><option value="changePercent">涨跌幅 %</option></select></label><label class="form-label">触发条件<select v-model="direction" aria-label="触发条件"><option value="above">达到或高于 ≥</option><option value="below">达到或低于 ≤</option></select></label></div>
 <label class="form-label">提醒阈值 <span>{{metric==='price'?desk.data.value.instruments[symbol]?.currency:'%'}}</span><input v-model="threshold" type="number" step="any" :min="metric==='price'?0.000001:-100" aria-label="提醒阈值" required/><small>当前{{metric==='price'?'价格':'涨跌幅'}}：{{number(quote?.[metric])}}{{metric==='changePercent'?'%':''}}</small></label>
 <label class="form-label">冷却时间 <span>分钟</span><input v-model="cooldown" type="number" min="1" max="1440" step="1" aria-label="冷却时间" required/></label>
 <p class="inline-notice"><Icon name="info"/>触发后需退出阈值区间再进入，且经过冷却期，才会再次提醒。收盘旧行情不会触发。</p>
 <p v-if="error" class="form-error" role="alert">{{error}}</p><div class="dialog-actions"><button type="button" class="button subtle" @click="emit('close')">取消</button><button type="submit" class="button primary"><Icon name="bell" :size="16"/>{{rule?'保存提醒':'创建提醒'}}</button></div>
 </form></BaseDialog></template>
