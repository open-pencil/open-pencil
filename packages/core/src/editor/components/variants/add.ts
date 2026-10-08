import { createComponentPropertyId, type SceneNode } from '@open-pencil/scene-graph'
import { buildVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import { VARIANT_SET_PADDING, variantSetProps } from '#core/editor/components/variant-set'
import { wrapSelectionInContainer } from '#core/editor/structure/container-wrap'
import type { EditorContext } from '#core/editor/types'

import { getComponentSet, getComponentSetVariants, getVariantDefinitions } from './model'

type SetFields = Pick<SceneNode, 'componentPropertyDefinitions' | 'width' | 'height'>
type VariantFields = Pick<
  SceneNode,
  'name' | 'componentPropertyValues' | 'componentPropertyDefinitions'
>

/** Figma names a set's first variant property `Property 1` and its first value `Default`. */
const FIRST_PROPERTY = 'Property 1'
const FIRST_VALUE = 'Default'

function setFields(node: SceneNode): SetFields {
  return {
    componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions),
    width: node.width,
    height: node.height
  }
}

function variantFields(node: SceneNode): VariantFields {
  return {
    name: node.name,
    componentPropertyValues: structuredClone(node.componentPropertyValues),
    componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions)
  }
}

/**
 * Make a standalone component the first variant of a new set, as Figma's Add variant does: the
 * set is named after it and padded like Combine as variants, the component keeps its node so its
 * instances follow it, and its own properties move to the set.
 */
function wrapInVariantSet(ctx: EditorContext, component: SceneNode): string | undefined {
  const parentId = component.parentId ?? ctx.state.currentPageId
  const setId = wrapSelectionInContainer(
    ctx,
    'COMPONENT_SET',
    [component],
    variantSetProps(ctx.graph, [component], parentId, 'canvas')
  )
  const set = setId ? ctx.graph.getNode(setId) : undefined
  if (!setId || !set) return undefined
  const setBefore = setFields(set)
  const componentBefore = variantFields(component)
  const setAfter: SetFields = {
    ...setBefore,
    componentPropertyDefinitions: [
      {
        id: createComponentPropertyId(),
        name: FIRST_PROPERTY,
        type: 'VARIANT',
        defaultValue: FIRST_VALUE,
        variantOptions: [FIRST_VALUE]
      },
      ...structuredClone(component.componentPropertyDefinitions)
    ]
  }
  const componentAfter: VariantFields = {
    name: buildVariantName({ [FIRST_PROPERTY]: FIRST_VALUE }),
    componentPropertyValues: { [FIRST_PROPERTY]: FIRST_VALUE },
    componentPropertyDefinitions: []
  }
  const apply = (setValues: SetFields, componentValues: VariantFields) => {
    ctx.graph.updateNode(setId, structuredClone(setValues))
    ctx.graph.updateNode(component.id, structuredClone(componentValues))
    ctx.requestRender()
  }
  ctx.undo.execute({
    label: 'Add variant',
    forward: () => apply(setAfter, componentAfter),
    inverse: () => apply(setBefore, componentBefore)
  })
  return setId
}

/** The first `Variant2`, `Variant3`, … no variant of the property uses yet, as Figma names them. */
function nextVariantValue(options: readonly string[]): string {
  const taken = new Set(options)
  let index = 2
  while (taken.has(`Variant${index}`)) index++
  return `Variant${index}`
}

/**
 * Copy `source` below the set's last variant, 20 apart, and grow the set to hold it. With
 * `nextValue`, the copy takes the next free value of the set's first variant property, as Figma's
 * Add variant does; without, it keeps the source's values for the caller to change.
 */
export function appendVariant(
  ctx: EditorContext,
  setId: string,
  source: SceneNode,
  nextValue: boolean
): string | undefined {
  const set = getComponentSet(ctx.graph, setId)
  const definition = getVariantDefinitions(ctx.graph, setId).at(0)
  if (!set || (nextValue && !definition)) return undefined
  assertNodeEditable(ctx.graph, source.id)
  const variants = getComponentSetVariants(ctx.graph, setId)
  const bottom = Math.max(...variants.map((variant) => variant.y + variant.height))
  const value = definition && nextValue ? nextVariantValue(definition.variantOptions ?? []) : null
  const values =
    definition && value
      ? { ...source.componentPropertyValues, [definition.name]: value }
      : source.componentPropertyValues
  const ordered = Object.fromEntries(
    getVariantDefinitions(ctx.graph, setId).map((item) => [item.name, values[item.name] ?? ''])
  )
  const clone = ctx.graph.cloneTree(source.id, setId, {
    x: source.x,
    y: bottom + VARIANT_SET_PADDING,
    name: buildVariantName(ordered),
    componentPropertyValues: values
  })
  if (!clone) return undefined
  const setBefore = setFields(set)
  const setAfter: SetFields = {
    componentPropertyDefinitions: set.componentPropertyDefinitions.map((item) =>
      value && item.id === definition?.id
        ? { ...item, variantOptions: [...(item.variantOptions ?? []), value] }
        : item
    ),
    width: Math.max(set.width, clone.x + clone.width + VARIANT_SET_PADDING),
    height: Math.max(set.height, clone.y + clone.height + VARIANT_SET_PADDING)
  }
  ctx.graph.updateNode(setId, structuredClone(setAfter))
  const snapshots = snapshotSubtree(ctx.graph, clone.id)
  ctx.setSelectedIds(new Set([clone.id]))
  ctx.undo.push({
    label: 'Add variant',
    forward: () => {
      const root = snapshots.get(clone.id)
      if (root) restoreSubtree(ctx.graph, root, setId, snapshots)
      ctx.graph.updateNode(setId, structuredClone(setAfter))
      ctx.setSelectedIds(new Set([clone.id]))
      ctx.requestRender()
    },
    inverse: () => {
      ctx.graph.deleteNode(clone.id)
      ctx.graph.updateNode(setId, structuredClone(setBefore))
      ctx.setSelectedIds(new Set([source.id]))
      ctx.requestRender()
    }
  })
  ctx.requestRender()
  return clone.id
}

/**
 * Figma's Add variant. A standalone component becomes a set first; a variant is copied as is,
 * and a set copies its last variant. The copy is selected.
 */
export function addVariant(ctx: EditorContext, nodeId: string): string | undefined {
  const node = ctx.graph.getNode(nodeId)
  if (node?.type !== 'COMPONENT' && node?.type !== 'COMPONENT_SET') return undefined
  assertNodeEditable(ctx.graph, nodeId)
  let result: string | undefined
  ctx.undo.runBatch('Add variant', () => {
    let setId = node.type === 'COMPONENT_SET' ? node.id : node.parentId
    if (node.type === 'COMPONENT' && (!setId || !getComponentSet(ctx.graph, setId)))
      setId = wrapInVariantSet(ctx, node) ?? null
    if (!setId) return
    const source =
      node.type === 'COMPONENT' ? node : getComponentSetVariants(ctx.graph, setId).at(-1)
    if (source) result = appendVariant(ctx, setId, source, true)
  })
  return result
}
