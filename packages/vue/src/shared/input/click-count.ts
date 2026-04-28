const MULTI_CLICK_DELAY = 500
const MULTI_CLICK_RADIUS = 5

export function createClickCounter() {
  let lastClickTime = 0
  let lastClickX = 0
  let lastClickY = 0
  let clickCount = 0

  function recordClick(sx: number, sy: number) {
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
