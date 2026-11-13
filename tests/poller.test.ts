import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPoller } from '../src/services/poller'
afterEach(()=>vi.useRealTimers())
describe('quote scheduler',()=>{
 it('runs immediately but never overlaps a pending refresh',async()=>{
  vi.useFakeTimers()
  let resolve!: ()=>void
  const task=vi.fn(()=>new Promise<void>(r=>{resolve=r}))
  const poller=createPoller(task,()=>1000)
  poller.start(); await vi.advanceTimersByTimeAsync(10000)
  expect(task).toHaveBeenCalledTimes(1)
  resolve(); await vi.advanceTimersByTimeAsync(1000)
  expect(task).toHaveBeenCalledTimes(2)
  poller.stop(); resolve()
 })
 it('backs off failed calls and cancels the pending controller on stop',async()=>{
  vi.useFakeTimers()
  const task=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  const poller=createPoller(task,()=>1000)
  poller.start(); await vi.advanceTimersByTimeAsync(1000)
  expect(task).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(task).toHaveBeenCalledTimes(2)
  poller.stop(); expect(task.mock.calls[1]![0].aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(10000);expect(task).toHaveBeenCalledTimes(2)
 })
 it('coalesces manual refreshes while busy instead of firing parallel requests',async()=>{
  let resolve!: ()=>void
  const task=vi.fn(()=>new Promise<void>(r=>{resolve=r}))
  const poller=createPoller(task,()=>1000)
  const a=poller.refresh(),b=poller.refresh();expect(task).toHaveBeenCalledTimes(1)
  resolve();await Promise.all([a,b]);poller.stop()
 })
})
