export function createRafScheduler(flush: () => void) {
  let rafId = 0

  function schedule() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      flush()
    })
  }

  function cancel() {
    if (!rafId) return
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  return { schedule, cancel }
}
