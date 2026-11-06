import type { TextLayoutBlock } from '#core/canvas/text/layout/block'

export function placeMarker(block: TextLayoutBlock): void {
  const marker = block.marker
  const first = block.metrics.at(0)
  if (!marker || !first) return
  const markerLine = marker.paragraph.getLineMetrics().at(0)
  const width = marker.paragraph.getLongestLine()
  // A bullet centres on the middle of the indent; a number ends a third of an em before the
  // text, so numbers of any width line up on their periods.
  if (block.rtl) {
    const start = block.x + first.left + first.width
    marker.x =
      marker.kind === 'bullet' ? start + marker.em * 0.75 - width / 2 : start + marker.em / 3
  } else {
    const start = block.x + first.left
    marker.x =
      marker.kind === 'bullet'
        ? start - marker.em * 0.75 - width / 2
        : start - marker.em / 3 - width
  }
  marker.y = block.y + first.baseline - (markerLine?.baseline ?? 0)
}
