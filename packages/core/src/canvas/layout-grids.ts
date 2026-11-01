import type { Canvas } from 'canvaskit-wasm'

import { readEffectiveFigmaRawField } from '@open-pencil/fig'
import type { SceneNode } from '@open-pencil/scene-graph'
import { layoutGridCount, layoutGuideSections } from '@open-pencil/scene-graph/layout'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { SELECTION_COLOR } from '#core/constants'

import type { SkiaRenderer } from './renderer'

type RawLayoutGrid = SceneNode['layoutGrids'][number] & {
  visible?: boolean
  color?: Color
  pattern?: string
  axis?: string
  type?: string
  alignment?: string
  numSections?: number
  count?: number | null
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
  const modeledGrids = (node as Partial<SceneNode>).layoutGrids ?? []
  if (modeledGrids.length > 0) return modeledGrids
  const source = (node as Partial<SceneNode>).source
  const grids = source ? readEffectiveFigmaRawField(node, 'layoutGrids') : undefined
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
  // An Auto count stays as it is: the sections drawn are as many as fit.
  const count = layoutGridCount(grid)
  const sectionSize = grid.sectionSize ?? 0
  const alignment = rawGridAlignment(grid)
  if (count <= 0) return null
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

function drawColumnGrid(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  grid: GridGeometry
): void {
  for (const section of layoutGuideSections(node, grid)) {
    canvas.drawRect(r.ck.LTRBRect(section.start, 0, section.end, node.height), r.auxFill)
  }
}

function drawRowGrid(r: SkiaRenderer, canvas: Canvas, node: SceneNode, grid: GridGeometry): void {
  for (const section of layoutGuideSections(node, grid)) {
    canvas.drawRect(r.ck.LTRBRect(0, section.start, node.width, section.end), r.auxFill)
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

const GRID_CONTAINER_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET', 'SECTION'])

export function drawLayoutGrids(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  // Only containers carry grids; every other layer skips the raw field read.
  if (!GRID_CONTAINER_TYPES.has(node.type)) return
  for (const rawGrid of rawLayoutGrids(node)) {
    const grid = gridGeometry(rawGrid)
    if (!grid) continue
    r.auxFill.setColorComponents(grid.color.r, grid.color.g, grid.color.b, grid.color.a)
    if (grid.pattern === 'GRID') drawSquareGrid(r, canvas, node, grid)
    else if (grid.pattern === 'ROWS') drawRowGrid(r, canvas, node, grid)
    else drawColumnGrid(r, canvas, node, grid)
  }
}
