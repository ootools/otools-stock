import { it, expect, vi } from 'vitest'
import { createPersistence } from '../src/services/persistence'
import { createDefaultData } from '../src/domain/snapshot'
it('uses host private plugin state and never sends portfolio to a market API',async()=>{
 const host={getPluginLocalState:vi.fn().mockResolvedValue(createDefaultData()),savePluginLocalState:vi.fn().mockResolvedValue(undefined)}
 const store=createPersistence({host})
 expect(await store.load()).toMatchObject({version:1})
 await store.save(createDefaultData())
 expect(host.getPluginLocalState).toHaveBeenCalledWith('otools-stock')
 expect(host.savePluginLocalState).toHaveBeenCalledWith('otools-stock',expect.objectContaining({version:1}))
})
it('does not fall back to browser storage on host failure or parse corrupted JSON as empty',async()=>{
 const storage={getItem:vi.fn().mockReturnValue('{broken'),setItem:vi.fn()}
 await expect(createPersistence({host:null,storage}).load()).rejects.toThrow(/损坏/)
 const host={getPluginLocalState:vi.fn().mockRejectedValue(new Error('host denied')),savePluginLocalState:vi.fn()}
 await expect(createPersistence({host,storage}).load()).rejects.toThrow('host denied')
 expect(storage.setItem).not.toHaveBeenCalled()
})
it('reports unavailable/quota storage instead of silently discarding trades',async()=>{
 const store=createPersistence({host:null,storage:{getItem:()=>null,setItem:()=>{throw new Error('quota')}}})
 expect(await store.load()).toBeNull()
 await expect(store.save(createDefaultData())).rejects.toThrow('quota')
})
