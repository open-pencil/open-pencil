import type { CompactImage, CompactNode, CompactSummary } from '#design-json/compact/types'
import { countBy, uniq } from 'es-toolkit'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { imageMimeType } from '@open-pencil/scene-graph/images'

/** Each node in the trees with how deep it sits, the roots at 1. */
function* nodesIn(nodes: readonly CompactNode[], depth = 1): Generator<[CompactNode, number]> {
  for (const node of nodes) {
    yield [node, depth]
    if (node.children) yield* nodesIn(node.children, depth + 1)
  }
}

/** An index of the trees: how many layers of each kind, the fonts, colors, and components. */
export function summarize(roots: readonly CompactNode[]): CompactSummary {
  const entries = [...nodesIn(roots)]
  const nodes = entries.map(([node]) => node)
  return {
    layers: nodes.length,
    depth: entries.reduce((deepest, [, depth]) => Math.max(deepest, depth), 0),
    byKind: countBy(nodes, (node) => node.kind),
    fonts: uniq(nodes.flatMap(fontOf)),
    colors: uniq(nodes.flatMap(colorsOf)),
    components: componentsShown(nodes),
    inferred: nodes.filter((node) => node.inferred).length
  }
}

function fontOf(node: CompactNode): string[] {
  if (!node.text) return []
  const { family, weight, italic } = node.text.font
  return [`${family} ${weight}${italic ? ' italic' : ''}`]
}

function colorsOf(node: CompactNode): string[] {
  const { style, text } = node
  return [
    ...(style?.fills ?? []),
    ...(style?.border?.colors ?? []),
    ...(text?.color ? [text.color] : [])
  ]
    .map((color) => color.value)
    .filter((color) => color.startsWith('#'))
}

function componentsShown(nodes: readonly CompactNode[]): CompactSummary['components'] {
  const shown: CompactSummary['components'] = {}
  for (const { component } of nodes) {
    if (!component) continue
    const entry = shown[component.id] ?? { name: component.name, instances: 0 }
    shown[component.id] = { ...entry, instances: entry.instances + 1 }
  }
  return shown
}

/** The images the trees draw, by hash, with the layers that draw each. */
export function compactImages(
  graph: SceneGraph,
  roots: readonly CompactNode[]
): Record<string, CompactImage> {
  const images: Record<string, CompactImage> = {}
  for (const [node] of nodesIn(roots)) {
    for (const hash of node.images ?? []) addImageUse(graph, images, hash, node.id)
  }
  return images
}

function addImageUse(
  graph: SceneGraph,
  images: Record<string, CompactImage>,
  hash: string,
  layerId: string
) {
  if (hash in images) {
    images[hash].usedBy.push(layerId)
    return
  }
  const data = graph.images.get(hash)
  if (!data) return
  images[hash] = { mimeType: imageMimeType(data), byteLength: data.byteLength, usedBy: [layerId] }
}
