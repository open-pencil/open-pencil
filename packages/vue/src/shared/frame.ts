import { useDocumentVisibility } from '@vueuse/core'
import { watch, type Ref } from 'vue'

/** Whether the browser shows the page; shared by every wait. */
const documentVisibility = useDocumentVisibility()

export interface NextFrameOptions {
  /** Whether the browser shows the page; the document's own by default. */
  visibility?: Readonly<Ref<DocumentVisibilityState>>
}

/**
 * Lets the page lay out and draw before going on: resolves on the next animation frame. A
 * hidden tab draws no frames and shows nothing, so work started in a background tab, such as
 * opening a file or starting the canvas, goes on at once rather than waiting until the tab is
 * shown again, and a tab hidden while waiting stops waiting.
 */
export function nextFrame(options: NextFrameOptions = {}): Promise<void> {
  const visibility = options.visibility ?? documentVisibility
  if (visibility.value === 'hidden') return Promise.resolve()
  return new Promise((resolve) => {
    let frame = 0
    const stop = watch(visibility, (state) => {
      if (state === 'hidden') done()
    })
    function done() {
      cancelAnimationFrame(frame)
      stop()
      resolve()
    }
    frame = requestAnimationFrame(done)
  })
}
