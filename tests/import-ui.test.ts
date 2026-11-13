import { it,expect,vi,afterEach } from 'vitest'
import { mount,flushPromises,type VueWrapper } from '@vue/test-utils'
import SettingsView from '../src/components/SettingsView.vue'
import BaseDialog from '../src/components/BaseDialog.vue'
import { createStockDesk } from '../src/composables/useStockDesk'
import { createDefaultData } from '../src/domain/snapshot'
import { trade } from './fixtures/domain'
const wrappers:VueWrapper[]=[]
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());document.body.innerHTML=''})
async function setup(){const desk=createStockDesk({provider:{quotes:vi.fn().mockResolvedValue([]),chart:vi.fn(),search:vi.fn()},persistence:{load:async()=>null,save:async()=>{} }});await desk.initialize();const wrapper=mount(SettingsView,{props:{desk},attachTo:document.body});wrappers.push(wrapper);return {desk,wrapper}}
async function upload(wrapper:VueWrapper,text:string){const input=wrapper.get('input[type="file"]');Object.defineProperty(input.element,'files',{value:[new File([text],'backup.json',{type:'application/json'})],configurable:true});await input.trigger('change');await new Promise(r=>setTimeout(r,10));await flushPromises()}
it('requires backup confirmation, supports cancellation, then restores a valid ledger',async()=>{
 const {desk,wrapper}=await setup(),restored=createDefaultData();restored.settings.refreshEnabled=false;restored.trades=[trade({id:'backup'})]
 await upload(wrapper,JSON.stringify(restored));expect(wrapper.findComponent(BaseDialog).exists()).toBe(true);expect(desk.data.value.trades).toHaveLength(0)
 wrapper.findComponent(BaseDialog).vm.$emit('close');await flushPromises();expect(desk.data.value.trades).toHaveLength(0)
 await upload(wrapper,JSON.stringify(restored));const button=Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(b=>b.textContent?.includes('确认恢复'))!
 button.click();await flushPromises();expect(desk.data.value.trades[0]!.id).toBe('backup');desk.dispose()
})
it('malicious/invalid backup stays rejected with no dialog and no state replacement',async()=>{
 const {desk,wrapper}=await setup();await upload(wrapper,'{"version":99,"name":"<script>alert(1)</script>"}')
 expect(wrapper.text()).toContain('版本不支持');expect(wrapper.findComponent(BaseDialog).exists()).toBe(false);expect(document.querySelector('script')).toBeNull();expect(desk.data.value.trades).toEqual([]);desk.dispose()
})
