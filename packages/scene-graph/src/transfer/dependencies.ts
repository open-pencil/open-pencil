import type { SceneGraph } from '../graph'
import { overriddenBindingField } from '../instances/overrides'
import { referencedStyleIds } from '../shared-styles'
import { styleRunReferences } from '../text/references'
import type { SceneNode } from '../types'
import { isUnsupportedVariableValue, variableValueReferences } from '../variables/value'
import { regionFills } from '../vector-network'

/** What layers need from their document to draw the same in another one. */
export interface LayerDependencies {
  /** The variables the layers and their styles bind, and every variable those alias. */
  variables: Set<string>
  /**
   * The collections of those variables, those the layers set a mode of, and those a kept
   * expression names a mode of.
   */
  collections: Set<string>
  /** The shared styles the layers use, as the style layers that define them. */
  styles: SceneNode[]
  /** The images the layers and their styles paint with. */
  images: Set<string>
}

/** The variables a layer names: its own bindings, its characters', and its overrides'. */
export function layerVariableIds(node: SceneNode): string[] {
  const { self, descendants } = node.instanceOverrides
  const overridden = [...self, ...[...descendants.values()].flatMap((fields) => [...fields])]
  return [
    ...Object.values(node.boundVariables),
    ...styleRunReferences(node.styleRuns).variables,
    ...overridden.flatMap(([field, value]) =>
      typeof value === 'string' && overriddenBindingField(field) !== null ? [value] : []
    )
  ]
}

/**
 * The images a layer paints with: its fills, strokes, vector regions, text decorations, and
 * characters.
 */
export function layerImageHashes(node: SceneNode): string[] {
  return [
    ...node.fills,
    ...node.strokes,
    ...regionFills(node.vectorNetwork),
    ...node.textDecorationFills,
    ...node.styleRuns.flatMap((run) => [
      ...(run.style.fills ?? []),
      ...(run.style.textDecorationFills ?? [])
    ])
  ].flatMap((paint) => (paint.type === 'IMAGE' && paint.imageHash ? [paint.imageHash] : []))
}

/**
 * The variables, collections, styles, and images `layers` depend on, as a copy into another
 * document must carry them: a style brings what it binds and paints with in turn, and a variable
 * brings the variables it aliases.
 */
export function layerDependencies(
  graph: SceneGraph,
  layers: Iterable<SceneNode>
): LayerDependencies {
  const collections = new Set<string>()
  const images = new Set<string>()
  const styles = new Map<string, SceneNode>()
  const pending: string[] = []
  let styleLayers: Map<string, SceneNode> | undefined
  const styleLayer = (id: string): SceneNode | undefined => {
    styleLayers ??= new Map(
      [...graph.getAllNodes()].flatMap((node) =>
        node.sharedStyleType !== null && node.source.id ? [[node.source.id, node] as const] : []
      )
    )
    return styleLayers.get(id)
  }
  const visit = (node: SceneNode): void => {
    for (const hash of layerImageHashes(node)) images.add(hash)
    pending.push(...layerVariableIds(node))
    for (const id of Object.keys(node.variableModes))
      if (graph.variableCollections.has(id)) collections.add(id)
    for (const id of referencedStyleIds(node)) {
      const style = styles.has(id) ? undefined : styleLayer(id)
      if (!style) continue
      styles.set(id, style)
      visit(style)
    }
  }
  for (const node of layers) visit(node)
  const resolved = variableDependencies(graph, pending)
  for (const id of resolved.collections) collections.add(id)
  return { variables: resolved.variables, collections, styles: [...styles.values()], images }
}

/**
 * These variables and every variable they alias, at any depth, with their collections and the
 * collections a kept expression names a mode of.
 */
export function variableDependencies(
  graph: SceneGraph,
  ids: Iterable<string>
): Pick<LayerDependencies, 'variables' | 'collections'> {
  const pending = [...ids]
  const variables = new Set<string>()
  const collections = new Set<string>()
  let modeCollections: Map<string, string> | undefined
  const collectionOfMode = (modeId: string): string | undefined => {
    modeCollections ??= new Map(
      [...graph.variableCollections.values()].flatMap((collection) =>
        collection.modes.map((mode) => [mode.modeId, collection.id] as const)
      )
    )
    return modeCollections.get(modeId)
  }
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (variables.has(id)) continue
    const variable = graph.variables.get(id)
    if (!variable) continue
    variables.add(id)
    collections.add(variable.collectionId)
    for (const value of Object.values(variable.valuesByMode)) {
      pending.push(...variableValueReferences(value))
      // A kept expression can name a mode of a collection none of its aliases reach.
      if (!isUnsupportedVariableValue(value)) continue
      for (const modeId of value.modes) {
        const collection = collectionOfMode(modeId)
        if (collection) collections.add(collection)
      }
    }
  }
  return { variables, collections }
}
