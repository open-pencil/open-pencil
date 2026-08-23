export const POINTER_DRAG_START_THRESHOLD_PX = 3

export function isPastPointerDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = POINTER_DRAG_START_THRESHOLD_PX
): boolean {
  const dx = currentX - startX
  const dy = currentY - startY
  return dx * dx + dy * dy >= threshold * threshold
}
