import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { SELECTION_COLOR } from '#core/constants'

import type { SkiaRenderer } from './renderer'

interface RawLayoutGrid {
  visible?: boolean
  color?: Color
  pattern?: string
  axis?: string
  type?: string
  alignment?: string
  numSections?: number
  count?: number
  offset?: number
  sectionSize?: number
  gutterSize?: number
}

interface GridGeometry {
  pattern: 'COLUMNS' | 'ROWS' | 'GRID'
  alignment: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  count: number
  offset: number
  sectionSize: number
  gutterSize: number
  color: Color
}

function rawLayoutGrids(node: SceneNode): RawLayoutGrid[] {
  const source = (node as Partial<SceneNode>).source
  const grids = source?.fig.rawNodeFields.layoutGrids
  if (!Array.isArray(grids)) return []
  return grids.filter((grid): grid is RawLayoutGrid => grid !== null && typeof grid === 'object')
}

function rawGridPattern(grid: RawLayoutGrid): GridGeometry['pattern'] {
  if (grid.pattern === 'GRID') return 'GRID'
  if (grid.pattern === 'ROWS') return 'ROWS'
  if (grid.pattern === 'COLUMNS') return 'COLUMNS'
  if (grid.axis === 'Y') return 'ROWS'
  return 'COLUMNS'
}

function rawGridAlignment(grid: RawLayoutGrid): GridGeometry['alignment'] {
  const value = grid.alignment ?? grid.type
  if (value === 'CENTER' || value === 'MAX' || value === 'STRETCH') return value
  return 'MIN'
}

function gridGeometry(grid: RawLayoutGrid): GridGeometry | null {
  if (grid.visible === false) return null
  const count = grid.count ?? grid.numSections ?? 1
  const sectionSize = grid.sectionSize ?? 0
  const alignment = rawGridAlignment(grid)
  if (!Number.isFinite(count) || count <= 0) return null
  if (rawGridPattern(grid) === 'GRID' && sectionSize <= 0) return null
  if (alignment !== 'STRETCH' && sectionSize <= 0) return null
  return {
    pattern: rawGridPattern(grid),
    alignment,
    count,
    offset: grid.offset ?? 0,
    sectionSize,
    gutterSize: grid.gutterSize ?? 0,
    color: grid.color ?? { ...SELECTION_COLOR, a: 0.1 }
  }
}

function gridSectionSize(nodeSize: number, grid: GridGeometry): number {
  if (grid.alignment !== 'STRETCH') return grid.sectionSize
  return (nodeSize - grid.offset * 2 - Math.max(0, grid.count - 1) * grid.gutterSize) / grid.count
}

function gridStart(nodeSize: number, grid: GridGeometry): number {
  const sectionSize = gridSectionSize(nodeSize, grid)
  const span = grid.count * sectionSize + Math.max(0, grid.count - 1) * grid.gutterSize
  if (grid.alignment === 'CENTER') return (nodeSize - span) / 2 + grid.offset
  if (grid.alignment === 'MAX') return nodeSize - span - grid.offset
  return grid.offset
}

function drawColumnGrid(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  grid: GridGeometry
): void {
  const sectionSize = gridSectionSize(node.width, grid)
  if (sectionSize <= 0) return
  const x0 = gridStart(node.width, grid)
  for (let index = 0; index < grid.count; index++) {
    const x = x0 + index * (sectionSize + grid.gutterSize)
    canvas.drawRect(r.ck.LTRBRect(x, 0, x + sectionSize, node.height), r.auxFill)
  }
}

function drawRowGrid(r: SkiaRenderer, canvas: Canvas, node: SceneNode, grid: GridGeometry): void {
  const sectionSize = gridSectionSize(node.height, grid)
  if (sectionSize <= 0) return
  const y0 = gridStart(node.height, grid)
  for (let index = 0; index < grid.count; index++) {
    const y = y0 + index * (sectionSize + grid.gutterSize)
    canvas.drawRect(r.ck.LTRBRect(0, y, node.width, y + sectionSize), r.auxFill)
  }
}

function drawSquareGrid(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  grid: GridGeometry
): void {
  for (let x = grid.offset; x < node.width; x += grid.sectionSize) {
    canvas.drawRect(r.ck.LTRBRect(x, 0, x + 1, node.height), r.auxFill)
  }
  for (let y = grid.offset; y < node.height; y += grid.sectionSize) {
    canvas.drawRect(r.ck.LTRBRect(0, y, node.width, y + 1), r.auxFill)
  }
}

export function drawLayoutGrids(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  for (const rawGrid of rawLayoutGrids(node)) {
    const grid = gridGeometry(rawGrid)
    if (!grid) continue
    r.auxFill.setColor(r.ck.Color4f(grid.color.r, grid.color.g, grid.color.b, grid.color.a))
    if (grid.pattern === 'GRID') drawSquareGrid(r, canvas, node, grid)
    else if (grid.pattern === 'ROWS') drawRowGrid(r, canvas, node, grid)
    else drawColumnGrid(r, canvas, node, grid)
  }
}
