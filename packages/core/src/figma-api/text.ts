import type { SceneGraph, SceneNode } from '#core/scene-graph'

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
}

export function insertCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  characters: string
): void {
  const text = node.text.slice(0, start) + characters + node.text.slice(start)
  graph.updateNode(node.id, { text })
}

export function deleteCharacters(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number
): void {
  const text = node.text.slice(0, start) + node.text.slice(end)
  graph.updateNode(node.id, { text })
}
