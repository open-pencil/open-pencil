import { jsx, type SyntaxNode } from '@open-pencil/emit'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { DesignDocument, DesignElement, DesignNode } from '../types'
import { mergeClassNames, serializeTailwindClasses } from './html'
import { sceneNodeToDesignDocument, type SceneGraphToDesignOptions } from './projection'

/** Engine services the projection takes, such as drawing vector layers as SVG. */
type ProjectionServices = Pick<SceneGraphToDesignOptions, 'vectorElement'>

/** HTML attribute names that JSX spells differently. */
const JSX_ATTRIBUTE_NAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  'xlink:href': 'xlinkHref'
}

/** React spells SVG's dashed attributes in camel case, such as `fillRule`; data and ARIA stay. */
function jsxAttributeName(name: string): string {
  const named = JSX_ATTRIBUTE_NAMES[name]
  if (named) return named
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** Scene text layers become paragraphs; Tailwind's preflight removes their margins. */
function tagName(node: DesignElement): string {
  return node.sourceSceneNode?.type === 'TEXT' ? 'p' : node.tagName
}

function attributes(node: DesignElement, themeVariables: readonly string[]): SyntaxNode[] {
  const { class: className, ...attrs } = node.attrs
  const name = node.sourceSceneNode?.name
  const entries: [string, string | undefined][] = [
    ['data-name', name && name !== node.sourceSceneNode?.type ? name : undefined],
    ...Object.entries(attrs),
    ['className', mergeClassNames(className, serializeTailwindClasses(node, themeVariables))]
  ]
  return entries.flatMap(([key, value]) =>
    value === undefined ? [] : [jsx.attribute(jsxAttributeName(key), jsx.stringValue(value))]
  )
}

function element(
  node: DesignElement,
  depth: number,
  themeVariables: readonly string[]
): SyntaxNode {
  const children = node.children.map((child) => jsxNode(child, depth + 1, themeVariables))
  // A lone text child stays on the element's line.
  const inline = children.length === 1 && node.children[0]?.type === 'text'
  return jsx.element(tagName(node), attributes(node, themeVariables), children, depth, inline)
}

function jsxNode(node: DesignNode, depth: number, themeVariables: readonly string[]): SyntaxNode {
  return node.type === 'text' ? jsx.text(node.text) : element(node, depth, themeVariables)
}

/** Print a design document as Tailwind JSX, one top-level element per block. */
export function designDocumentToTailwindJSX(document: DesignDocument): string {
  const themeVariables = document.tokens?.themeVariables() ?? []
  return document.children
    .map((node) => jsx.printJSX(jsxNode(node, 0, themeVariables)))
    .join('\n\n')
}

/** Tailwind JSX for scene nodes, separated by blank lines. */
export function sceneNodesToTailwindJSX(
  graph: SceneGraph,
  nodeIds: string[],
  options: ProjectionServices = {}
): string {
  return sceneNodesToTailwindJSXWithLayers(graph, nodeIds, options).code
}

/** Tailwind JSX with the layer behind each element, in the order elements open. */
export interface TailwindJSXWithLayers {
  code: string
  /** One entry per JSX element in pre-order; `null` for an element no layer produced. */
  layerIds: Array<string | null>
}

function collectLayerIds(node: DesignNode, layerIds: Array<string | null>): void {
  if (node.type === 'text') return
  layerIds.push(node.sourceSceneNodeId ?? node.sourceSceneNode?.id ?? null)
  for (const child of node.children) collectLayerIds(child, layerIds)
}

export function sceneNodesToTailwindJSXWithLayers(
  graph: SceneGraph,
  nodeIds: string[],
  { vectorElement }: ProjectionServices = {}
): TailwindJSXWithLayers {
  const layerIds: Array<string | null> = []
  const blocks: string[] = []
  for (const id of nodeIds) {
    const document = sceneNodeToDesignDocument(graph, id, {
      includeSourceIds: false,
      vectorElement
    })
    const code = designDocumentToTailwindJSX(document)
    if (!code) continue
    blocks.push(code)
    for (const node of document.children) collectLayerIds(node, layerIds)
  }
  return { code: blocks.join('\n\n'), layerIds }
}
