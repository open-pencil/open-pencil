import {
  sceneNodeToDesignDocument,
  type SceneGraphToDesignOptions
} from '#dom-css/export/projection'
import type { DesignElement, DesignNode, DesignText } from '#dom-css/types'
import { omit } from 'es-toolkit/object'

import {
  behaviourOwner,
  instanceMainComponent,
  instanceSlotFrames,
  layerPath,
  partBinding,
  readBehaviour,
  readIcon,
  slotPropertyId,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { StateElement } from './types'

/** A variant's projected layer, keyed so the same layer matches across variants. */
export interface VariantLayer {
  type: 'element'
  key: string
  kind: string | undefined
  name: string
  element: DesignElement
  children: Array<VariantLayer | DesignText>
}

/** Where the set places a variant, which is not the component's own style. */
export const PLACEMENT = ['position', 'left', 'top', 'right', 'bottom', 'inset']

function textContent(element: DesignElement): string | null {
  const texts = element.children.filter((child): child is DesignText => child.type === 'text')
  return texts.length > 0 ? texts.map((text) => text.text).join('') : null
}

/**
 * What a layer draws other than its own box: an instance of a component (of any of its set's
 * variants), or an icon. Undefined for any other layer.
 */
export function layerKind(graph: SceneGraph, node: SceneNode | undefined): string | undefined {
  if (!node) return undefined
  if (node.type === 'INSTANCE') {
    const main = instanceMainComponent(graph, node)
    const owner = main && behaviourOwner(graph, main)
    return `instance ${owner?.id ?? ''}`
  }
  const icon = readIcon(node)
  return icon ? `icon ${icon.name}` : undefined
}

function variantLayer(
  graph: SceneGraph,
  variant: SceneNode,
  node: DesignNode,
  parentKey: string,
  index: number
): VariantLayer | DesignText {
  if (node.type === 'text') return node
  const source = node.sourceSceneNodeId
  const path = source ? layerPath(graph, variant.id, source) : `${parentKey}/~${index}`
  const text = textContent(node)
  const kind = layerKind(graph, node.sourceSceneNode)
  // A label that reads differently in a variant is a different layer, shown by its state, and
  // so is a layer drawn as another component or icon, or as one instead of its own box.
  const key = [path, ...(kind ? [kind] : []), ...(text === null ? [] : [text])].join('\0')
  return {
    type: 'element',
    key,
    kind,
    name: node.sourceSceneNode?.name ?? node.tagName,
    element: node,
    children: node.children.map((child, i) => variantLayer(graph, variant, child, key, i))
  }
}

/**
 * The tab panels a variant draws hidden behind the first. The generated tabs show each when its
 * tab is chosen, so they are projected as drawn.
 */
function tabPanels(graph: SceneGraph, variant: SceneNode): Set<string> {
  const owner = behaviourOwner(graph, variant)
  const behaviour = owner && readBehaviour(owner)
  const propertyId = behaviour?.kind === 'tabs' ? partBinding(behaviour, 'panels') : undefined
  const panels = propertyId
    ? instanceSlotFrames(graph, variant).find((frame) => slotPropertyId(frame) === propertyId)
    : undefined
  return new Set(panels?.childIds)
}

/**
 * The layers of a variant a boolean property shows or hides, which are projected however the
 * variant draws them, since the generated component shows them from its prop.
 */
function visibilityBound(graph: SceneGraph, variant: SceneNode): Set<string> {
  const bound = new Set<string>()
  const visit = (node: SceneNode) => {
    for (const child of graph.getChildren(node.id)) {
      if (child.componentPropertyReferences.some((item) => item.field === 'VISIBLE'))
        bound.add(child.id)
      if (child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(variant)
  return bound
}

/** A variant projected to DOM, without where the set places it. */
export function projectVariant(
  graph: SceneGraph,
  variant: SceneNode,
  { vectorElement }: Pick<SceneGraphToDesignOptions, 'vectorElement'> = {}
): VariantLayer | null {
  const document = sceneNodeToDesignDocument(graph, variant.id, {
    includeSourceIds: false,
    vectorElement,
    shown: new Set([...tabPanels(graph, variant), ...visibilityBound(graph, variant)])
  })
  const root = document.children.at(0)
  if (root?.type !== 'element') return null
  const style = root.inlineStyle ?? {}
  // Absolutely placed layers inside still need the root as their containing block.
  root.inlineStyle = {
    ...omit(style, PLACEMENT),
    ...(style.position ? { position: 'relative' } : {})
  }
  return {
    type: 'element',
    key: '',
    kind: undefined,
    name: variant.name,
    element: root,
    children: root.children.map((child, i) => variantLayer(graph, variant, child, '', i))
  }
}

/** Every layer of a projected variant by key. */
export function layersByKey(
  root: VariantLayer,
  into = new Map<string, VariantLayer>()
): Map<string, VariantLayer> {
  into.set(root.key, root)
  for (const child of root.children) if (child.type === 'element') layersByKey(child, into)
  return into
}

/** A merged layer starting from a variant's layer, with that layer's style as its base. */
export function stateElement(layer: VariantLayer): StateElement {
  return {
    type: 'element',
    key: layer.key,
    kind: layer.kind,
    name: layer.name,
    tagName: layer.element.tagName,
    attrs: { ...layer.element.attrs },
    base: { ...layer.element.inlineStyle },
    rules: [],
    children: layer.children.map((child) => (child.type === 'text' ? child : stateElement(child)))
  }
}

function hideAtRest(element: StateElement, hidden: Set<StateElement>): void {
  element.base = { ...element.base, display: 'none' }
  hidden.add(element)
  for (const child of element.children) if (child.type === 'element') hideAtRest(child, hidden)
}

/**
 * Adds the layers only `variant` draws to the merged tree, after the sibling they follow
 * there. Each keeps the style this variant draws it with, hidden at rest, and is recorded in
 * `hidden` so the variants that draw it show it again.
 */
export function mergeVariant(
  into: StateElement,
  variant: VariantLayer,
  hidden: Set<StateElement>
): void {
  let previous = -1
  for (const child of variant.children) {
    if (child.type === 'text') continue
    const index = into.children.findIndex(
      (item) => item.type === 'element' && item.key === child.key
    )
    const existing = into.children.at(index)
    if (index !== -1 && existing?.type === 'element') {
      mergeVariant(existing, child, hidden)
      previous = index
      continue
    }
    const added = stateElement(child)
    hideAtRest(added, hidden)
    previous += 1
    into.children.splice(previous, 0, added)
  }
}

/** Every element of the merged tree, root first. */
export function allElements(root: StateElement, into: StateElement[] = []): StateElement[] {
  into.push(root)
  for (const child of root.children) if (child.type === 'element') allElements(child, into)
  return into
}
