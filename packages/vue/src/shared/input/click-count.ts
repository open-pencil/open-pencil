const MULTI_CLICK_DELAY = 500
const MULTI_CLICK_RADIUS = 5

export function createClickCounter() {
  let lastClickTime = 0
  let lastClickX = 0
  let lastClickY = 0
  let clickCount = 0

  /**
   * Counts a press in a run of clicks. `detail`, the browser's own count for the press, stands
   * when it is higher: the browser times the run from the input itself, while a frame that took
   * longer than the window between two presses would restart the count here.
   */
  function recordClick(sx: number, sy: number, detail = 0) {
    const now = performance.now()
    if (
      now - lastClickTime < MULTI_CLICK_DELAY &&
      Math.abs(sx - lastClickX) < MULTI_CLICK_RADIUS &&
      Math.abs(sy - lastClickY) < MULTI_CLICK_RADIUS
    ) {
      clickCount++
    } else {
      clickCount = 1
    }
    clickCount = Math.max(clickCount, detail)
    lastClickTime = now
    lastClickX = sx
    lastClickY = sy
    return clickCount
  }

  function getClickCount() {
    return clickCount
  }

  return { recordClick, getClickCount }
}
