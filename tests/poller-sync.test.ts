import { it,expect,vi } from 'vitest'
import { createPoller } from '../src/services/poller'
it('turns a synchronous provider throw into a settled failed refresh that can be retried',async()=>{
 let calls=0
 const poller=createPoller(()=>{calls++;if(calls===1)throw new Error('sync failure');return Promise.resolve()},()=>1000)
 await expect(poller.refresh()).rejects.toThrow('sync failure')
 await expect(poller.refresh()).resolves.toBeUndefined();poller.stop()
})
