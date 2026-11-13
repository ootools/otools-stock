import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { buildChartGeometry, movingAverage } from '../src/domain/chart'
import StockChart from '../src/components/StockChart.vue'
import type { ChartData } from '../src/domain/types'
import { maotai, tencent } from './fixtures/domain'
const history:ChartData={symbol:maotai.symbol,period:'day',source:'腾讯财经',fetchedAt:1,adjustment:'前复权',points:Array.from({length:25},(_,i)=>({time:`2026-11-${String(i+1).padStart(2,'0')}`,open:100+i,close:101+i,high:103+i,low:99+i,volume:1000+i}))}
describe('honest chart geometry',()=>{
 it('only computes a moving average after a real full window',()=>{
  expect(movingAverage(history.points,5).slice(0,4)).toEqual([null,null,null,null])
  expect(movingAverage(history.points,5)[4]).toBe(103)
 })
 it('supports flat prices and zero volume without NaN or invented candles',()=>{
  const flat=buildChartGeometry([{time:'10:00',open:1,close:1,high:1,low:1,volume:0}],true)
  expect(flat.candles).toHaveLength(1)
  expect(JSON.stringify(flat)).not.toMatch(/NaN|Infinity/)
  expect(flat.linePath).toMatch(/^M/)
 })
 it('renders real candle data with OHLC context and empty-provider errors without fabricated paths',async()=>{
  const provider={quotes:vi.fn(),search:vi.fn(),chart:vi.fn().mockResolvedValue(history)}
  const wrapper=mount(StockChart,{props:{instrument:maotai,provider,refreshToken:0,initialPeriod:'day'}})
  await flushPromises();expect(wrapper.findAll('[data-candle]').length).toBe(25)
  expect(wrapper.text()).toContain('前复权');wrapper.unmount()
  const empty=mount(StockChart,{props:{instrument:maotai,provider:{...provider,chart:vi.fn().mockRejectedValue(new Error('暂无有效数据'))},refreshToken:0}})
  await flushPromises();expect(empty.text()).toContain('暂无有效数据');expect(empty.find('svg.stock-plot').exists()).toBe(false);empty.unmount()
 })
 it('aborts and ignores a previous selection that resolves after the latest one',async()=>{
  const resolvers:((value:ChartData)=>void)[]=[],signals:AbortSignal[]=[]
  const provider={quotes:vi.fn(),search:vi.fn(),chart:vi.fn((_i,_p,s)=>{signals.push(s);return new Promise<ChartData>(r=>resolvers.push(r))})}
  const wrapper=mount(StockChart,{props:{instrument:maotai,provider,refreshToken:0,initialPeriod:'day'}})
  await wrapper.setProps({instrument:tencent})
  expect(signals[0]!.aborted).toBe(true)
  resolvers[1]!({...history,symbol:tencent.symbol,source:'新证券行情'})
  await flushPromises();resolvers[0]!(history);await flushPromises()
  expect(wrapper.text()).toContain('新证券行情');expect(wrapper.text()).not.toContain('腾讯财经');wrapper.unmount()
 })
})

it('switches the public daily/weekly/monthly histories through the actual K-line buttons',async()=>{
 const provider={quotes:vi.fn(),search:vi.fn(),chart:vi.fn(async(stock,period)=>({...history,symbol:stock.symbol,period}))}
 const wrapper=mount(StockChart,{props:{instrument:maotai,provider,refreshToken:0}})
 try {
  await flushPromises()
  for(const [label,period] of [['日 K','day'],['周 K','week'],['月 K','month']] as const){
   const button=wrapper.findAll('.segmented button').find(b=>b.text()===label)!
   await button.trigger('click');await flushPromises()
   expect(provider.chart).toHaveBeenLastCalledWith(maotai,period,expect.any(AbortSignal))
   expect(button.attributes('aria-pressed')).toBe('true')
   expect(wrapper.findAll('[data-candle]')).toHaveLength(25)
   expect(wrapper.findAll('.plot-ma')).toHaveLength(3)
  }
 } finally {wrapper.unmount()}
})
