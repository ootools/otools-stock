export function createPoller(task: (signal: AbortSignal) => Promise<void>, interval: () => number) {
  let running = false, pending: Promise<void> | null = null, controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null, failures = 0
  const clear = () => { if (timer !== null) { clearTimeout(timer); timer = null } }
  const schedule = () => {
    clear()
    if (running) timer = setTimeout(() => { void refresh().catch(() => {}) }, Math.min(120000, Math.max(1000, interval()) * 2 ** Math.min(failures, 4)))
  }
  function refresh(): Promise<void> {
    if (pending) return pending
    clear(); controller = new AbortController()
    // Start immediately so manual refresh is coalesced before the next microtask.
    let result: Promise<void>
    try { result = task(controller.signal) } catch (error) { result = Promise.reject(error) }
    pending = result.then(() => { failures = 0 }, error => { if (error?.name !== 'AbortError') failures += 1; throw error }).finally(() => { pending = null; schedule() })
    return pending
  }
  return {
    start() { if (running) return; running = true; void refresh().catch(() => {}) },
    stop() { running = false; clear(); controller?.abort() },
    refresh,
    reschedule() { if (running && !pending) schedule() },
  }
}
