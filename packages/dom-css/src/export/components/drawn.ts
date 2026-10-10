import { isEqual } from 'es-toolkit/predicate'

import type {
  ComponentPropertyReferenceField,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'

/** What a layer draws, which an instance can change without a property. */
const DRAWN = [
  'fills',
  'strokes',
  'effects',
  'opacity',
  'cornerRadius',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic'
] as const satisfies readonly (keyof SceneNode)[]

/** How a layer lays out what it holds, which an instance can change without a property. */
const LAYOUT = [
  'layoutMode',
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'primaryAxisAlign',
  'counterAxisAlign'
] as const satisfies readonly (keyof SceneNode)[]

const same = (a: SceneNode, b: SceneNode, fields: readonly (keyof SceneNode)[]) =>
  fields.every((field) => isEqual(a[field], b[field]))

const bound = (node: SceneNode, field: ComponentPropertyReferenceField) =>
  node.componentPropertyReferences.some((reference) => reference.field === field)

function childrenMatch(graph: SceneGraph, drawn: SceneNode, main: SceneNode): boolean {
  const children = graph.getChildren(drawn.id)
  const mains = graph.getChildren(main.id)
  return (
    children.length === mains.length &&
    children.every((child, index) => {
      const counterpart = mains.at(index)
      return counterpart !== undefined && layerMatches(graph, child, counterpart)
    })
  )
}

/**
 * Whether a layer of an instance draws as its main component's does, apart from what a
 * property of the component sets: the text a text property shows and what a boolean property
 * shows or hides, which the component's props pass on.
 */
function layerMatches(graph: SceneGraph, drawn: SceneNode, main: SceneNode): boolean {
  if (drawn.type !== main.type) return false
  if (!bound(main, 'VISIBLE') && drawn.visible !== main.visible) return false
  if (drawn.type === 'TEXT' && !bound(main, 'TEXT') && drawn.text !== main.text) return false
  if (drawn.type === 'INSTANCE' && drawn.componentId !== main.componentId) return false
  return same(drawn, main, DRAWN) && same(drawn, main, LAYOUT) && childrenMatch(graph, drawn, main)
}

/**
 * Whether an instance draws exactly as the variant it shows, so a generated component given
 * its property values draws it: the same look, layout, words, and nested components, apart
 * from where its parent places and sizes it. An instance with any other change, such as edited
 * text no property sets or a fill of its own, draws its own layers instead.
 */
export function drawsAsMain(graph: SceneGraph, instance: SceneNode, main: SceneNode): boolean {
  return (
    same(instance, main, DRAWN) &&
    same(instance, main, LAYOUT) &&
    childrenMatch(graph, instance, main)
  )
}
