import type { AppData, Persistence } from '../domain/types'
export const STORAGE_KEY = 'otools-stock:state:v1'
export interface HostStore { getPluginLocalState(plugin: string): Promise<unknown>; savePluginLocalState(plugin: string,state: AppData): Promise<void> }
export function createPersistence(options: { host?: HostStore | null; storage?: Pick<Storage,'getItem'|'setItem'> } = {}): Persistence {
  const host = options.host !== undefined ? options.host : typeof window !== 'undefined' && window.otools?.getPluginLocalState ? window.otools : null
  const storage = () => options.storage || (typeof window !== 'undefined' ? window.localStorage : null)
  return {
    async load() {
      if (host) return await host.getPluginLocalState('otools-stock')
      const store = storage()
      if (!store) throw new Error('本地存储不可用')
      const raw = store.getItem(STORAGE_KEY)
      if (raw === null) return null
      try { return JSON.parse(raw) } catch { throw new Error('本地数据已损坏，原始数据已保留，请从备份恢复') }
    },
    async save(data) {
      if (host) { await host.savePluginLocalState('otools-stock',data); return }
      const store = storage()
      if (!store) throw new Error('本地存储不可用')
      store.setItem(STORAGE_KEY,JSON.stringify(data))
    },
  }
}
