import type { Color } from '../primitives'
import type { LayoutGrid, SceneNode } from '../types'

export interface LayoutGuideLine {
  axis: 'x' | 'y'
  position: number
}

/** The most lines one guide draws or snaps to on an axis. */
export const MAX_LAYOUT_GUIDE_LINES = 10_000

/** Figma's Auto count, as its archive stores it: as many sections as fit. */
export const AUTO_LAYOUT_GRID_COUNT = 2_147_483_647

/** Whether a guide's count is Auto: the archive's value, or the plugin API's `Infinity` or `null`. */
export function isAutoGridCount(count: number | null | undefined): boolean {
  return count === null || count === Infinity || (count ?? 0) >= AUTO_LAYOUT_GRID_COUNT
}

/**
 * A guide's count, set in Figma's plugin shape (`count`) or read from a file (`numSections`); an
 * edit's `count` wins over the count the file had. Auto is {@link AUTO_LAYOUT_GRID_COUNT}.
 */
export function layoutGridCount(grid: LayoutGrid): number {
  const count = grid.count === undefined ? grid.numSections : grid.count
  return isAutoGridCount(count) ? AUTO_LAYOUT_GRID_COUNT : (count ?? 1)
}

/** Figma's color for a new guide: red at 10%. */
export const DEFAULT_LAYOUT_GRID_COLOR: Readonly<Color> = Object.freeze({
  r: 1,
  g: 0,
  b: 0,
  a: 0.1
})

/** A guide's pattern in Figma's plugin names, from either shape: the archive's `STRIPES` along an `axis`. */
export function layoutGridPattern(
  grid: Pick<LayoutGrid, 'pattern' | 'axis'>
): 'COLUMNS' | 'ROWS' | 'GRID' {
  if (grid.pattern === 'GRID' || grid.pattern === 'ROWS' || grid.pattern === 'COLUMNS') {
    return grid.pattern
  }
  return grid.axis === 'Y' ? 'ROWS' : 'COLUMNS'
}

/**
 * A guide's alignment, from either shape. One set without any stretches, as the plugin API and
 * export have read it; a file's guide always has one, as Figma drops a guide without it.
 */
export function layoutGridAlignment(
  grid: Pick<LayoutGrid, 'alignment' | 'type'>
): 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' {
  return grid.alignment ?? grid.type ?? 'STRETCH'
}

/** A guide's color, Figma's new-guide red for one set without any. */
export function layoutGridColor(grid: Pick<LayoutGrid, 'color'>): Color {
  return { ...(grid.color ?? DEFAULT_LAYOUT_GRID_COLOR) }
}

const pattern = layoutGridPattern
const alignment = layoutGridAlignment

/**
 * How many sections a guide draws. Auto fits as many fixed sections as the frame holds, counting
 * the offset once from the aligned edge, as Figma desktop 126 draws them.
 */
function sectionCount(nodeSize: number, grid: LayoutGrid): number {
  const value = layoutGridCount(grid)
  if (value === AUTO_LAYOUT_GRID_COUNT) {
    const size = grid.sectionSize ?? 0
    if (alignment(grid) === 'STRETCH' || size <= 0) return 0
    const gutter = grid.gutterSize ?? 0
    const offset = alignment(grid) === 'CENTER' ? 0 : (grid.offset ?? 0)
    return Math.min(
      MAX_LAYOUT_GUIDE_LINES,
      Math.max(0, Math.floor((nodeSize - offset + gutter) / (size + gutter)))
    )
  }
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_LAYOUT_GUIDE_LINES, Math.max(0, Math.floor(value)))
}

function sectionSize(nodeSize: number, grid: LayoutGrid, count: number): number {
  const fixed = grid.sectionSize ?? 0
  if (alignment(grid) !== 'STRETCH') return fixed
  const gutter = grid.gutterSize ?? 0
  const offset = grid.offset ?? 0
  return (nodeSize - offset * 2 - Math.max(0, count - 1) * gutter) / count
}

function start(nodeSize: number, grid: LayoutGrid, size: number, count: number): number {
  const gutter = grid.gutterSize ?? 0
  const offset = grid.offset ?? 0
  const span = count * size + Math.max(0, count - 1) * gutter
  if (alignment(grid) === 'CENTER') return (nodeSize - span) / 2 + offset
  if (alignment(grid) === 'MAX') return nodeSize - span - offset
  return offset
}

export interface LayoutGuideSection {
  axis: 'x' | 'y'
  start: number
  end: number
}

export function layoutGuideSections(
  node: Pick<SceneNode, 'width' | 'height'>,
  grid: LayoutGrid
): LayoutGuideSection[] {
  if (grid.visible === false || pattern(grid) === 'GRID') return []
  const axis = pattern(grid) === 'ROWS' ? 'y' : 'x'
  const nodeSize = axis === 'x' ? node.width : node.height
  const count = sectionCount(nodeSize, grid)
  const size = sectionSize(nodeSize, grid, count)
  if (count <= 0 || size <= 0) return []
  const first = start(nodeSize, grid, size, count)
  const step = size + (grid.gutterSize ?? 0)
  return Array.from({ length: count }, (_, index) => {
    const sectionStart = first + index * step
    return { axis, start: sectionStart, end: sectionStart + size }
  })
}

export function layoutGuideLines(node: Pick<SceneNode, 'width' | 'height'>, grid: LayoutGrid) {
  if (grid.visible === false) return []
  const gridPattern = pattern(grid)
  const lines: LayoutGuideLine[] = []
  if (gridPattern === 'GRID') {
    const size = grid.sectionSize ?? 0
    if (size <= 0) return lines
    for (
      let index = 0, x = grid.offset ?? 0;
      x <= node.width && index < MAX_LAYOUT_GUIDE_LINES;
      index++, x += size
    ) {
      lines.push({ axis: 'x', position: x })
    }
    for (
      let index = 0, y = grid.offset ?? 0;
      y <= node.height && index < MAX_LAYOUT_GUIDE_LINES;
      index++, y += size
    ) {
      lines.push({ axis: 'y', position: y })
    }
    return lines
  }

  const sections = layoutGuideSections(node, grid)
  for (const section of sections) {
    lines.push(
      { axis: section.axis, position: section.start },
      { axis: section.axis, position: section.end }
    )
  }
  return lines
}
