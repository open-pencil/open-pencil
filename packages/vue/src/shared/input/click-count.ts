const MULTI_CLICK_DELAY = 500
const MULTI_CLICK_RADIUS = 5

export function createClickCounter() {
  let lastClickTime = 0
  let lastClickX = 0
  let lastClickY = 0
  let clickCount = 0

  /**
   * Counts a press in a run of clicks. `detail`, the browser's own count for the press, is the
   * count when the event carries one: the system times the run by its own double-click speed. A
   * press without one, such as a dispatched event, is counted here by time and distance.
   */
  function recordClick(sx: number, sy: number, detail = 0) {
    const now = performance.now()
    if (detail > 0) {
      clickCount = detail
    } else if (
      now - lastClickTime < MULTI_CLICK_DELAY &&
      Math.abs(sx - lastClickX) < MULTI_CLICK_RADIUS &&
      Math.abs(sy - lastClickY) < MULTI_CLICK_RADIUS
    ) {
      clickCount++
    } else {
      clickCount = 1
    }
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
