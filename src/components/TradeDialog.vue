<script setup lang="ts">
import { ref,computed,watch } from 'vue'
import type { Instrument,Trade } from '../domain/types'
import type { StockDesk } from '../composables/useStockDesk'
import { localDate,currencySymbol,number } from '../domain/format'
import BaseDialog from './BaseDialog.vue'
import Icon from './Icon.vue'
const props=defineProps<{desk:StockDesk;instrument?:Instrument;trade?:Trade}>(),emit=defineEmits<{close:[];saved:[]}>()
const instruments=computed(()=>Object.values(props.desk.data.value.instruments).filter(i=>i.kind==='stock'))
const symbol=ref(props.trade?.symbol||props.instrument?.symbol||props.desk.selectedSymbol.value||instruments.value[0]?.symbol||'')
const type=ref<Trade['type']>(props.trade?.type||'buy'),date=ref(props.trade?.date||localDate()),quantity=ref(String(props.trade?.quantity||'')),price=ref(String(props.trade?.price??props.desk.data.value.quoteCache[symbol.value]?.price??'')),fees=ref(String(props.trade?.fees??0)),note=ref(props.trade?.note||''),error=ref('')
watch(symbol,()=>{if(!props.trade)price.value=String(props.desk.data.value.quoteCache[symbol.value]?.price??'')})
const instrument=computed(()=>props.desk.data.value.instruments[symbol.value]),estimated=computed(()=>Number(quantity.value)*Number(price.value)+(type.value==='sell'?-1:1)*Number(fees.value))
function submit(){error.value='';try{const trade:Trade={id:props.trade?.id||props.desk.newId('trade'),symbol:symbol.value,type:type.value,date:date.value,quantity:Number(quantity.value),price:Number(price.value),fees:Number(fees.value),note:note.value};if(props.trade)props.desk.updateTrade(trade);else props.desk.addTrade(trade);emit('saved');emit('close')}catch(e){error.value=e instanceof Error?e.message:'交易记录无效'}}
</script>
<template><BaseDialog :title="trade?'编辑交易记录':'记录持股交易'" subtitle="仅本地记账，不连接券商，不执行真实交易" @close="emit('close')"><form class="dialog-form" @submit.prevent="submit">
 <label class="form-label">股票<select v-model="symbol" aria-label="交易股票" :disabled="!!trade"><option v-for="stock in instruments" :key="stock.symbol" :value="stock.symbol">{{stock.name}} · {{stock.code}} · {{stock.currency}}</option></select></label>
 <div class="form-row"><label class="form-label">交易类型<select v-model="type" aria-label="交易类型"><option value="buy">买入</option><option value="sell">卖出</option><option value="opening">期初持股（存量）</option></select></label><label class="form-label">交易日期<input v-model="date" type="date" aria-label="交易日期" required/></label></div>
 <div class="form-row"><label class="form-label">数量 <span>股</span><input v-model="quantity" type="number" min="0.0001" max="100000000" step="0.0001" aria-label="数量" placeholder="100" required/></label><label class="form-label">成交价 <span>{{instrument?.currency}}</span><input v-model="price" type="number" min="0.000001" step="0.000001" aria-label="成交价" placeholder="每股成本或成交价" required/></label></div>
 <label class="form-label">费用 <span>全部佣金与税费</span><input v-model="fees" type="number" min="0" step="0.000001" aria-label="费用" required/></label>
 <label class="form-label">备注<textarea v-model="note" rows="2" maxlength="500" aria-label="交易备注" placeholder="可选，最多 500 字"/></label>
 <p v-if="type==='opening'" class="inline-notice"><Icon name="info"/>期初持股视为该日开盘前已有的存量。每只股票最多一笔，日期需早于买卖记录。</p>
 <div class="trade-estimate"><span>{{type==='sell'?'卖出净收入':'含费用金额'}}</span><strong class="mono">{{instrument?currencySymbol(instrument.currency):''}}{{number(Number.isFinite(estimated)?estimated:null)}}</strong></div>
 <p v-if="error" class="form-error" role="alert">{{error}}</p><div class="dialog-actions"><button class="button subtle" type="button" @click="emit('close')">取消</button><button class="button primary" type="submit"><Icon name="check" :size="16"/>保存记录</button></div>
 </form></BaseDialog></template>
