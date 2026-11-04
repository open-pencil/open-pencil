import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'

/**
 * A component set's boolean, text, instance swap, and slot properties are its own, but a .fig
 * file gives every variant a copy of each under an id of its own, linked to the set's by
 * `parentPropDefId`; the variant's layers bind to its copy, and an instance of the variant
 * assigns it. Figma's scripts see only the set's property, whichever variant shows (desktop
 * 126), and OpenPencil keeps the set's alone, as it does for the sets it makes.
 */

/** A variant's copies, each by its own id to the id of the set property it copies. */
export type PropertyCopies = ReadonlyMap<string, string>

/** The set a variant belongs to, or none for any other node. */
export function variantSet(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  if (node.type !== 'COMPONENT' || !node.parentId) return undefined
  const parent = graph.getNode(node.parentId)
  return parent?.type === 'COMPONENT_SET' ? parent : undefined
}

/**
 * The variant whose properties a layer's references name: the variant itself or the one it is
 * drawn in, or, inside an instance, the instance's component, whose layers it copies. An
 * instance's own references belong to where it is drawn.
 */
export function bindingVariant(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  const holder = graph.closest(node.id, (candidate) =>
    candidate === node
      ? !!variantSet(graph, candidate)
      : candidate.type === 'INSTANCE' || !!variantSet(graph, candidate)
  )
  if (holder?.type !== 'INSTANCE') return holder
  return instanceVariant(graph, holder)
}

/**
 * The variant an instance shows, if it shows one. An instance nested in another instance links
 * to the layer it was copied from, so this follows those links to the component.
 */
export function instanceVariant(graph: SceneGraph, instance: SceneNode): SceneNode | undefined {
  if (instance.type !== 'INSTANCE') return undefined
  const main = instanceMainComponent(graph, instance)
  return main && variantSet(graph, main) ? main : undefined
}

/**
 * Keeps a variant's copies as the file saved them, `{ id, parentPropDefId }`, in its raw fields,
 * which the export writes them from again (`variantPropertyCopies`): the layers and instances
 * a save leaves untouched still name these GUIDs. A document read from an archive keeps no other
 * raw fields on its layers. Each copy records the variant it was read for (`keptBy`): a duplicate
 * of the variant carries the same list, and only the variant the file saved writes those GUIDs.
 */
function keepCopyGuids(variant: SceneNode, copies: ReadonlyMap<string, string>): void {
  const componentPropDefs = [...copies].map(([copy, property]) => ({
    id: stringToGuid(copy),
    parentPropDefId: stringToGuid(property),
    keptBy: variant.id
  }))
  variant.source = {
    ...variant.source,
    fig: {
      ...variant.source.fig,
      rawNodeFields: { ...variant.source.fig.rawNodeFields, componentPropDefs }
    }
  }
}

/**
 * Gives the layers just read the set's properties in place of their variants' copies: a
 * variant drops its copies, a layer drawn in it, or in an instance of it, binds to the set's
 * properties, and an instance of it assigns them. `copiesOf` reads a variant's copies from its
 * record, so a variant read on an earlier page still links the instances of a later one.
 * Property ids are only unique within a set, as a set copied in the same file keeps its
 * properties' ids, so a copy stands only for a property of its own set.
 */
export function foldVariantPropertyCopies(
  graph: SceneGraph,
  materialized: readonly SceneNode[],
  copiesOf: (variant: SceneNode) => PropertyCopies
): void {
  const cache = new Map<string, Map<string, string>>()
  const copies = (variant: SceneNode): Map<string, string> => {
    let own = cache.get(variant.id)
    if (!own) {
      const set = variantSet(graph, variant)
      const properties = new Set(set?.componentPropertyDefinitions.map((item) => item.id))
      own = new Map([...copiesOf(variant)].filter(([, property]) => properties.has(property)))
      cache.set(variant.id, own)
    }
    return own
  }
  for (const node of materialized) {
    const own = variantSet(graph, node) ? copies(node) : undefined
    if (own?.size) {
      node.componentPropertyDefinitions = node.componentPropertyDefinitions.filter(
        (definition) => !own.has(definition.id)
      )
      keepCopyGuids(node, own)
    }
    if (node.componentPropertyReferences.length > 0) {
      const variant = bindingVariant(graph, node)
      const bound = variant ? copies(variant) : undefined
      if (bound?.size)
        node.componentPropertyReferences = node.componentPropertyReferences.map((reference) => {
          const property = bound.get(reference.propertyId)
          return property ? { ...reference, propertyId: property } : reference
        })
    }
    const main = instanceVariant(graph, node)
    const assigned = main ? copies(main) : undefined
    if (assigned?.size)
      node.componentPropertyAssignments = Object.fromEntries(
        Object.entries(node.componentPropertyAssignments).map(([propertyId, value]) => [
          assigned.get(propertyId) ?? propertyId,
          value
        ])
      )
  }
}
