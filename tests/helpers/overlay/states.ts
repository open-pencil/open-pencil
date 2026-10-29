import type { Page } from '@playwright/test'

/** Dialogs, alert dialogs, and popovers as Reka renders their content. */
export const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [data-slot="popover-content"]'

/** What the overlay showed on one animation frame: its text, or null when none was in the page. */
export type OverlayFrame = string | null

/**
 * Records the overlay's text on every animation frame while `action` runs and until the page
 * settles, keeping only frames that differ from the one before. An overlay that animates open
 * or closed without flicker records its content once; one that redraws mid-animation records
 * each version it drew.
 */
export async function recordOverlayFrames(
  page: Page,
  action: () => Promise<void>,
  { selector = OVERLAY_SELECTOR, settleFrames = 30 } = {}
): Promise<OverlayFrame[]> {
  const recorder = await page.evaluateHandle(
    ({ selector, settleFrames }) => {
      const frames: (string | null)[] = []
      let unchanged = 0
      // Settling counts only after the action ran, however long it takes.
      let counting = false
      let done = false
      let resolveSettled: () => void = () => undefined
      const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve
      })
      const read = (): string | null => {
        const overlays = [...document.querySelectorAll<HTMLElement>(selector)]
        if (overlays.length === 0) return null
        return overlays.map((overlay) => overlay.innerText.replace(/\s+/g, ' ').trim()).join(' | ')
      }
      const tick = () => {
        if (done) return
        const frame = read()
        if (frames.length === 0 || frames[frames.length - 1] !== frame) {
          frames.push(frame)
          unchanged = 0
        } else if (counting && ++unchanged >= settleFrames) {
          resolveSettled()
        }
        requestAnimationFrame(tick)
      }
      tick()
      return {
        frames,
        settled,
        armed: () => {
          unchanged = 0
          counting = true
        },
        stop: () => {
          done = true
          return frames
        }
      }
    },
    { selector, settleFrames }
  )
  try {
    await action()
    await recorder.evaluate((state) => state.armed())
    await recorder.evaluate((state) => state.settled)
    return await recorder.evaluate((state) => state.stop())
  } finally {
    // Stops the frame loop even when a step threw, so it does not run for the rest of the test.
    await recorder.evaluate((state) => state.stop()).catch(() => undefined)
    await recorder.dispose()
  }
}

/** The distinct contents an overlay showed, leaving out the frames with no overlay. */
export function overlayContents(frames: OverlayFrame[]): string[] {
  return frames.filter((frame): frame is string => frame !== null)
}
