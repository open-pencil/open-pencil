import type { TextLayoutBlock } from '#core/canvas/text/layout/block'

export function blockOrigin(block: TextLayoutBlock): number {
  return block.rtl ? 0 : block.inset
}

export function placeMarker(block: TextLayoutBlock, firstLineStart: number): void {
  const marker = block.marker
  const first = block.metrics.at(0)
  if (!marker || !first) {
    return
  }
  const markerLine = marker.paragraph.getLineMetrics().at(0)
  const width = marker.paragraph.getLongestLine()
  const lineStart = blockOrigin(block) + firstLineStart
  // A bullet centres on the middle of the indent; a number ends a third of an em before the
  // text, so numbers of any width line up on their periods.
  if (block.rtl) {
    const start = lineStart + first.width
    marker.x =
      marker.kind === 'bullet' ? start + marker.em * 0.75 - width / 2 : start + marker.em / 3
  } else {
    marker.x =
      marker.kind === 'bullet'
        ? lineStart - marker.em * 0.75 - width / 2
        : lineStart - marker.em / 3 - width
  }
  marker.y = block.y + first.baseline - (markerLine?.baseline ?? 0)
}
