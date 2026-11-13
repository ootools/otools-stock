import { it, expect, vi } from 'vitest'
import { createHttpTransport } from '../src/services/http'
it('decodes host response bytes using GB18030 instead of mojibake body_text', async () => {
  const invoke = vi.fn().mockResolvedValue({status:200,body_base64:Buffer.from([0xb9,0xf3,0xd6,0xdd]).toString('base64'),body_text:'����'})
  const transport = createHttpTransport({ invoke, useHost:true })
  expect(await transport('/__market/quotes?symbols=sh600519',undefined,'gb18030')).toBe('贵州')
  expect(invoke).toHaveBeenCalledWith('otools_host_http_send',expect.objectContaining({request:expect.objectContaining({url:'https://qt.gtimg.cn/q=sh600519',timeout_secs:12})}))
})
it('uses same-origin browser proxy for preview and checks HTTP error/byte bound', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('test',{status:200}))
  const transport = createHttpTransport({ useHost:false, fetcher })
  expect(await transport('/__market/search?q=maotai')).toBe('test')
  expect(fetcher.mock.calls[0]![0]).toBe('/__market/search?q=maotai')
  const failing = createHttpTransport({ useHost:false, fetcher: vi.fn().mockResolvedValue(new Response('',{status:503})) })
  await expect(failing('/__market/search?q=x')).rejects.toThrow(/503/)
})
it('allows only known market routes and rejects aborted invocations immediately', async () => {
  const transport = createHttpTransport({ useHost:false, fetcher:vi.fn() })
  await expect(transport('https://evil.test')).rejects.toThrow()
  const controller = new AbortController(); controller.abort()
  await expect(transport('/__market/search?q=x',controller.signal)).rejects.toMatchObject({name:'AbortError'})
})
