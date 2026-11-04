/**
 * Lets the page lay out and draw before going on: resolves on the next animation frame. A
 * hidden tab draws no frames and shows nothing, so work started in a background tab, such as
 * opening a file or starting the canvas, goes on at once rather than waiting until the tab is
 * shown again, and a tab hidden while waiting stops waiting.
 */
export function nextFrame(): Promise<void> {
  if (document.visibilityState === 'hidden') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', hidden)
      resolve()
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') done()
    }
    const frame = requestAnimationFrame(done)
    document.addEventListener('visibilitychange', hidden)
  })
}
