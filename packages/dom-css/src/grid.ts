import type { GridTrack, SceneNode } from '@open-pencil/scene-graph'

import type { DesignStyleDeclaration } from './types'

function trackToCSS(track: GridTrack): string {
  if (track.sizing === 'FR') return `${track.value}fr`
  if (track.sizing === 'FIXED') return `${track.value}px`
  return 'auto'
}

/** Equal `1fr` tracks use Tailwind's `grid-cols-N` form, which keeps them from overflowing. */
function tracksToCSS(tracks: GridTrack[]): string {
  if (tracks.every((track) => track.sizing === 'FR' && track.value === 1))
    return `repeat(${tracks.length}, minmax(0, 1fr))`
  return tracks.map(trackToCSS).join(' ')
}

export function addGridContainer(style: DesignStyleDeclaration, node: SceneNode): void {
  style.display = 'grid'
  if (node.gridTemplateColumns.length > 0)
    style['grid-template-columns'] = tracksToCSS(node.gridTemplateColumns)
  if (node.gridTemplateRows.length > 0)
    style['grid-template-rows'] = tracksToCSS(node.gridTemplateRows)
  if (node.gridColumnGap > 0) style['column-gap'] = `${node.gridColumnGap}px`
  if (node.gridRowGap > 0) style['row-gap'] = `${node.gridRowGap}px`
}

/** A span sets the whole placement, so the start follows it. */
export function addGridPlacement(style: DesignStyleDeclaration, node: SceneNode): void {
  const position = node.gridPosition
  if (!position) return
  if (position.columnSpan > 1)
    style['grid-column'] = `span ${position.columnSpan} / span ${position.columnSpan}`
  if (position.column > 0) style['grid-column-start'] = String(position.column)
  if (position.rowSpan > 1)
    style['grid-row'] = `span ${position.rowSpan} / span ${position.rowSpan}`
  if (position.row > 0) style['grid-row-start'] = String(position.row)
}
