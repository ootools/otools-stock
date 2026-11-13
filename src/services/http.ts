import { invoke as sdkInvoke } from 'otools-plugin-sdk'
import { marketTarget } from '../../scripts/market-routes.mjs'
import type { TextTransport } from './market'
export interface HttpOptions { invoke?: (command: string, args: Record<string, unknown>) => Promise<unknown>; useHost?: boolean; fetcher?: typeof fetch }
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const abortError = () => new DOMException('请求已取消', 'AbortError')
export function hostAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window.otools || window.__TAURI_INTERNALS__?.invoke)
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const stop = () => reject(abortError())
    signal.addEventListener('abort', stop, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop))
  })
}
export function createHttpTransport(options: HttpOptions = {}): TextTransport {
  return async (path, externalSignal, encoding = 'utf-8') => {
    const target = marketTarget(path)
    if (externalSignal?.aborted) throw abortError()
    const controller = new AbortController()
    const stop = () => controller.abort()
    externalSignal?.addEventListener('abort', stop, { once: true })
    const timer = setTimeout(stop, 13000)
    try {
      let bytes: Uint8Array
      if (options.useHost ?? hostAvailable()) {
        const invoke = options.invoke || sdkInvoke
        const raw = await abortable(invoke('otools_host_http_send', { request: { method: 'GET', url: target.href, headers: [{ key:'Referer',value:'https://stockapp.finance.qq.com/',enabled:true }], cookies:[], params:[], body_type:'none', body:'', timeout_secs:12, follow_redirects:false } }), controller.signal)
        const response = raw as { status: number; body_base64?: string; body_text?: string; size?: number }
        if (!response || response.status < 200 || response.status >= 300) throw new Error(`行情请求失败（HTTP ${response?.status ?? '未知'}）`)
        if (response.size && response.size > MAX_RESPONSE_BYTES) throw new Error('行情响应过大')
        if (response.body_base64) {
          if (response.body_base64.length > MAX_RESPONSE_BYTES * 1.34) throw new Error('行情响应过大')
          bytes = Uint8Array.from(atob(response.body_base64), c => c.charCodeAt(0))
        } else if (typeof response.body_text === 'string') bytes = new TextEncoder().encode(response.body_text)
        else throw new Error('宿主未返回行情内容')
      } else {
        const response = await (options.fetcher || fetch)(path, { method:'GET', signal:controller.signal, credentials:'omit', cache:'no-store', redirect:'error' })
        if (!response.ok) throw new Error(`行情请求失败（HTTP ${response.status}）`)
        if (Number(response.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) throw new Error('行情响应过大')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('行情内容为空')
        const chunks: Uint8Array[] = []; let length = 0
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          length += value.length
          if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('行情响应过大') }
          chunks.push(value)
        }
        bytes = new Uint8Array(length); let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      }
      if (controller.signal.aborted) throw abortError()
      if (bytes.length > MAX_RESPONSE_BYTES) throw new Error('行情响应过大')
      return new TextDecoder(encoding).decode(bytes)
    } finally { clearTimeout(timer); externalSignal?.removeEventListener('abort', stop) }
  }
}
