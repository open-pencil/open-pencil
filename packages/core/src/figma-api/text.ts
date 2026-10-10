import { recordInstanceOverride } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { styleNameToWeight, weightToStyleName, type FigmaFontName } from './fonts'

export function getFontName(node: SceneNode): FigmaFontName {
  return { family: node.fontFamily, style: weightToStyleName(node.fontWeight, node.italic) }
}

export function setFontName(graph: SceneGraph, nodeId: string, fontName: FigmaFontName): void {
  const { weight, italic } = styleNameToWeight(fontName.style)
  graph.updateNode(nodeId, {
    fontFamily: fontName.family,
    fontWeight: weight,
    italic
  })
  recordInstanceOverride(graph, nodeId, ['fontFamily', 'fontWeight'])
}

/** Figma's plugin API line height: automatic, or a size in pixels or percent of the font size. */
export type FigmaLineHeight = { unit: 'AUTO' } | { unit: 'PIXELS' | 'PERCENT'; value: number }
/** Figma's plugin API letter spacing, in pixels or percent of the font size. */
export interface FigmaLetterSpacing {
  unit: 'PIXELS' | 'PERCENT'
  value: number
}

/** The node keeps sizes in pixels; a percent is of its font size when set, as Figma resolves it. */
function pixels(value: { unit: 'PIXELS' | 'PERCENT'; value: number }, fontSize: number) {
  return value.unit === 'PERCENT' ? (value.value / 100) * fontSize : value.value
}

export function getLineHeight(node: SceneNode): FigmaLineHeight {
  return node.lineHeight == null ? { unit: 'AUTO' } : { unit: 'PIXELS', value: node.lineHeight }
}

/**
 * Accepts Figma's object, or a bare number of pixels or `null` for automatic, as earlier
 * OpenPencil scripts wrote it.
 */
export function lineHeightValue(
  node: SceneNode,
  value: FigmaLineHeight | number | null
): number | null {
  if (value === null || typeof value === 'number') return value
  return value.unit === 'AUTO' ? null : pixels(value, node.fontSize)
}

export function getLetterSpacing(node: SceneNode): FigmaLetterSpacing {
  return { unit: 'PIXELS', value: node.letterSpacing }
}

/** Accepts Figma's object, or a bare number of pixels as earlier OpenPencil scripts wrote it. */
export function letterSpacingValue(node: SceneNode, value: FigmaLetterSpacing | number): number {
  return typeof value === 'number' ? value : pixels(value, node.fontSize)
}

export function insertCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  characters: string
): void {
  const text = node.text.slice(0, start) + characters + node.text.slice(start)
  graph.updateNode(node.id, { text })
  recordInstanceOverride(graph, node.id, ['text'])
}

export function deleteCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number
): void {
  const text = node.text.slice(0, start) + node.text.slice(end)
  graph.updateNode(node.id, { text })
  recordInstanceOverride(graph, node.id, ['text'])
}
