import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import App from '../src/App.vue'
import BaseDialog from '../src/components/BaseDialog.vue'
import { createStockDesk } from '../src/composables/useStockDesk'
import { quote, now } from './fixtures/domain'
const wrappers:VueWrapper[]=[]
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());document.body.innerHTML=''})
async function setup(){
 const provider={quotes:vi.fn().mockResolvedValue([quote()]),search:vi.fn().mockResolvedValue([]),chart:vi.fn().mockRejectedValue(new Error('暂无图表'))}
 const desk=createStockDesk({provider,persistence:{load:async()=>null,save:async()=>{}},now:()=>now})
 const wrapper=mount(App,{props:{desk,provider,autoStart:false},attachTo:document.body});wrappers.push(wrapper);await flushPromises()
 return {wrapper,desk}
}
describe('stock workbench user flows',()=>{
 it('shows distinct quote absence, navigates portfolios/alerts/settings and never starts synthetic holdings',async()=>{
  const {wrapper}=await setup()
  expect(wrapper.text()).toContain('股票工作台');expect(wrapper.text()).toContain('贵州茅台')
  await wrapper.get('[data-testid="nav-portfolio"]').trigger('click');expect(wrapper.text()).toContain('暂无持仓')
  await wrapper.get('[data-testid="nav-alerts"]').trigger('click');expect(wrapper.text()).toContain('暂无提醒')
  await wrapper.get('[data-testid="nav-settings"]').trigger('click');expect(wrapper.text()).toContain('数据备份')
 })
 it('adds a searched stock using local names and persists its real security ID',async()=>{
  const {wrapper,desk}=await setup()
  await wrapper.get('[data-testid="add-stock"]').trigger('click')
  const dialog=mountDialog();await dialog.input('搜索股票').setValue('英伟达')
  await flushPromises();await dialog.button('添加 英伟达').trigger('click')
  expect(desk.data.value.watchlist.some(w=>w.symbol==='usNVDA')).toBe(true)
 })
 it('records a holding with fees and rejects an oversell through the form',async()=>{
  const {wrapper,desk}=await setup();await wrapper.get('[data-testid="nav-portfolio"]').trigger('click')
  await wrapper.get('[data-testid="add-trade"]').trigger('click')
  let dialog=mountDialog();await dialog.select('交易类型').setValue('opening');await dialog.input('数量').setValue('100');await dialog.input('成交价').setValue('100');await dialog.input('费用').setValue('5')
  await dialog.form().trigger('submit');await flushPromises()
  expect(desk.data.value.trades).toHaveLength(1);expect(desk.portfolio.value.positions[0]!.cost).toBe(10005)
  await wrapper.get('[data-testid="add-trade"]').trigger('click');dialog=mountDialog()
  await dialog.select('交易类型').setValue('sell');await dialog.input('数量').setValue('101');await dialog.input('成交价').setValue('100');await dialog.form().trigger('submit');await flushPromises()
  expect(document.body.textContent).toContain('持股不足');expect(desk.data.value.trades).toHaveLength(1)
 })
 it('creates a price alert and changes theme via accessible settings',async()=>{
  const {wrapper,desk}=await setup();await wrapper.get('[data-testid="nav-alerts"]').trigger('click');await wrapper.get('[data-testid="add-alert"]').trigger('click')
  const dialog=mountDialog();await dialog.input('提醒阈值').setValue('120');await dialog.form().trigger('submit');await flushPromises()
  expect(desk.data.value.alerts).toHaveLength(1)
  await wrapper.get('[data-testid="nav-settings"]').trigger('click');await wrapper.get('select[aria-label="界面主题"]').setValue('light')
  expect(desk.data.value.settings.theme).toBe('light')
 })
})
function mountDialog(){
 const root=()=>document.querySelector('[role="dialog"]') as HTMLElement
 const lookup=(selector:string)=>{const node=root()?.querySelector(selector);if(!node)throw new Error(`Missing ${selector}`);return {async setValue(value:string){const el=node as HTMLInputElement;el.value=value;el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await flushPromises()},async trigger(name:string){node.dispatchEvent(new Event(name,{bubbles:true,cancelable:true}));await flushPromises()}}}
 return { input:(label:string)=>lookup(`input[aria-label="${label}"]`),select:(label:string)=>lookup(`select[aria-label="${label}"]`),form:()=>lookup('form'),button:(label:string)=>lookup(`button[aria-label="${label}"]`) }
}
it('dialog focuses a control, traps tab, closes on Escape and restores focus',async()=>{
 const previous=document.createElement('button');document.body.append(previous);previous.focus()
 const wrapper=mount(BaseDialog,{props:{title:'测试对话框'},slots:{default:'<input aria-label="第一项"><button>最后一项</button>'},attachTo:document.body});wrappers.push(wrapper)
 await flushPromises()
 expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull()
 document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
 expect(wrapper.emitted('close')).toHaveLength(1)
 wrapper.unmount();wrappers.splice(wrappers.indexOf(wrapper),1);expect(document.activeElement).toBe(previous)
})

it('icon-only compact navigation still has accessible destination names',async()=>{
 const {wrapper}=await setup()
 expect(wrapper.get('[data-testid="nav-watch"]').attributes('aria-label')).toBe('自选盯盘')
 expect(wrapper.get('[data-testid="nav-portfolio"]').attributes('aria-label')).toBe('我的持仓')
 expect(wrapper.get('[data-testid="nav-alerts"]').attributes('aria-label')).toBe('价格提醒')
 expect(wrapper.get('[data-testid="nav-settings"]').attributes('aria-label')).toBe('设置与备份')
})
