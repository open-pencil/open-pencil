import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'
import { buildVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

import {
  collectVariantOptions,
  getComponentSet,
  getComponentSetVariants,
  getVariantDefinitions
} from './model'

/** A component set's property definitions and its variants' values and names, for undo. */
export type VariantSnapshot = {
  definitions: ComponentPropertyDefinition[]
  variants: Map<string, Pick<SceneNode, 'componentPropertyValues' | 'name'>>
}

export function assertComponentSetEditable(ctx: EditorContext, componentSetId: string): void {
  assertNodeEditable(ctx.graph, componentSetId)
  for (const variant of getComponentSetVariants(ctx.graph, componentSetId)) {
    assertNodeEditable(ctx.graph, variant.id)
  }
}

export function captureVariantSnapshot(
  ctx: EditorContext,
  componentSetId: string
): VariantSnapshot | null {
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  if (!componentSet) return null
  return {
    definitions: structuredClone(componentSet.componentPropertyDefinitions),
    variants: new Map(
      getComponentSetVariants(ctx.graph, componentSetId).map((variant) => [
        variant.id,
        {
          componentPropertyValues: structuredClone(variant.componentPropertyValues),
          name: variant.name
        }
      ])
    )
  }
}

export function restoreVariantSnapshot(
  ctx: EditorContext,
  componentSetId: string,
  snapshot: VariantSnapshot
): void {
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  if (!componentSet) return
  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: structuredClone(snapshot.definitions)
  })
  for (const [variantId, variantSnapshot] of snapshot.variants) {
    if (!ctx.graph.getNode(variantId)) continue
    ctx.graph.updateNode(variantId, {
      componentPropertyValues: structuredClone(variantSnapshot.componentPropertyValues),
      name: variantSnapshot.name
    })
  }
  ctx.requestRender()
}

export function recordSnapshotChange(
  ctx: EditorContext,
  componentSetId: string,
  label: string,
  before: VariantSnapshot,
  after: VariantSnapshot
): void {
  ctx.undo.push({
    label,
    forward: () => restoreVariantSnapshot(ctx, componentSetId, after),
    inverse: () => restoreVariantSnapshot(ctx, componentSetId, before)
  })
  ctx.requestRender()
}

export function updateVariantName(
  ctx: EditorContext,
  componentSetId: string,
  variant: SceneNode
): void {
  const values = Object.fromEntries(
    getVariantDefinitions(ctx.graph, componentSetId).map((definition) => [
      definition.name,
      variant.componentPropertyValues[definition.name] ?? ''
    ])
  )
  ctx.graph.updateNode(variant.id, { name: buildVariantName(values) })
}

export function refreshVariantOptions(ctx: EditorContext, componentSetId: string): void {
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  if (!componentSet) return
  const collected = collectVariantOptions(ctx.graph, componentSetId)
  const definitions = componentSet.componentPropertyDefinitions.map((definition) => {
    if (definition.type !== 'VARIANT') return definition
    const present = collected.get(definition.name) ?? new Set<string>()
    const options = [
      ...(definition.variantOptions ?? []).filter((value) => present.has(value)),
      ...[...present].filter((value) => !definition.variantOptions?.includes(value))
    ]
    return {
      ...definition,
      defaultValue: options.includes(definition.defaultValue)
        ? definition.defaultValue
        : (options[0] ?? ''),
      variantOptions: options
    }
  })
  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: definitions
  })
}

/** Set a variant's property values and rename it to match. */
export function setVariantValues(
  ctx: EditorContext,
  componentSetId: string,
  variantId: string,
  componentPropertyValues: Record<string, string>
): void {
  ctx.graph.updateNode(variantId, { componentPropertyValues })
  const updated = ctx.graph.getNode(variantId)
  if (updated) updateVariantName(ctx, componentSetId, updated)
}
