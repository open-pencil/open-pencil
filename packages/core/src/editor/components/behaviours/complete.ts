import {
  createComponentPropertyId,
  createSlotProperty,
  readBehaviour,
  type Behaviour,
  type SceneNode
} from '@open-pencil/scene-graph'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { createVariantActions } from '#core/editor/components/variants'
import type { EditorContext } from '#core/editor/types'

type VariantActions = Pick<
  ReturnType<typeof createVariantActions>,
  'addPropertyDefinition' | 'duplicateVariant' | 'setVariantPropertyValue'
>

/** The components a behaviour's properties live in: a set's variants, or the component. */
function variantsOf(ctx: EditorContext, owner: SceneNode): SceneNode[] {
  return owner.type === 'COMPONENT_SET'
    ? ctx.graph.getChildren(owner.id).filter((child) => child.type === 'COMPONENT')
    : [owner]
}

/** The first text layer of a component that no text property shows yet. */
function freeTextLayer(ctx: EditorContext, root: SceneNode): SceneNode | undefined {
  for (const child of ctx.graph.getChildren(root.id)) {
    if (child.type === 'INSTANCE') continue
    const bound = child.componentPropertyReferences.some((item) => item.field === 'TEXT')
    if (child.type === 'TEXT' && !bound) return child
    const nested = freeTextLayer(ctx, child)
    if (nested) return nested
  }
  return undefined
}

/**
 * Actions that create what a behaviour is missing and bind it in the same undo step, so a
 * bare component becomes a working control from the Behaviour section alone.
 */
export function createBehaviourCompletionActions(
  ctx: EditorContext,
  setBehaviour: (ownerId: string, behaviour: Behaviour | null) => void,
  variants: VariantActions
) {
  function owned(ownerId: string) {
    const owner = ctx.graph.getNode(ownerId)
    const behaviour = owner && readBehaviour(owner)
    return owner && behaviour ? { owner, behaviour } : null
  }

  /**
   * Show a text value through a new text property named `name`. Each variant's first text
   * layer that no property shows becomes its target; a variant without one gets a new text
   * layer inset in it.
   */
  function addBehaviourText(ownerId: string, valueId: string, name: string): string | null {
    const found = owned(ownerId)
    if (!found) return null
    const { owner, behaviour } = found
    const id = createComponentPropertyId()
    ctx.undo.runBatch(`Add ${name} text`, () => {
      recordSubtreeEdit(ctx, `Add ${name} text`, owner.id, () => {
        let defaultValue = name
        for (const variant of variantsOf(ctx, owner)) {
          const layer =
            freeTextLayer(ctx, variant) ??
            ctx.graph.createNode('TEXT', variant.id, {
              name,
              text: name,
              x: 12,
              y: 12,
              width: Math.max(1, variant.width - 24),
              height: 16,
              fontSize: 14,
              textAutoResize: 'HEIGHT'
            })
          defaultValue = layer.text || defaultValue
          ctx.graph.updateNode(layer.id, {
            componentPropertyReferences: [
              ...layer.componentPropertyReferences,
              { propertyId: id, field: 'TEXT' }
            ]
          })
        }
        const current = ctx.graph.getNode(owner.id) ?? owner
        ctx.graph.updateNode(owner.id, {
          componentPropertyDefinitions: [
            ...current.componentPropertyDefinitions,
            { id, name, type: 'TEXT', defaultValue }
          ]
        })
      })
      setBehaviour(owner.id, {
        ...behaviour,
        texts: { ...behaviour.texts, [valueId]: { propertyId: id } }
      })
    })
    return id
  }

  /**
   * Hold a boolean value in a new variant property `name` with values Off and On: every
   * variant is drawn Off, and a copy of each is added drawn On, ready to restyle.
   */
  function addBehaviourVariant(setId: string, valueId: string, name: string): string | null {
    const found = owned(setId)
    if (found?.owner.type !== 'COMPONENT_SET') return null
    const { owner, behaviour } = found
    return ctx.undo.runBatch(`Add ${name} variants`, () => {
      const id = variants.addPropertyDefinition(owner.id, name, 'VARIANT', 'Off')
      if (!id) return null
      for (const variant of variantsOf(ctx, owner)) {
        const copy = variants.duplicateVariant(variant.id)
        if (copy) variants.setVariantPropertyValue(copy, id, 'On')
      }
      setBehaviour(owner.id, {
        ...behaviour,
        booleans: { ...behaviour.booleans, [valueId]: { propertyId: id, on: 'On', off: 'Off' } }
      })
      return id
    })
  }

  /** Make a new frame inside a main component the slot for a part named `name`. */
  function addBehaviourPart(componentId: string, partId: string, name: string): string | null {
    const found = owned(componentId)
    if (found?.owner.type !== 'COMPONENT') return null
    const { owner, behaviour } = found
    const id = createComponentPropertyId()
    ctx.undo.runBatch(`Add ${name} slot`, () => {
      recordSubtreeEdit(ctx, `Add ${name} slot`, owner.id, () => {
        const frame = ctx.graph.createNode('FRAME', owner.id, {
          name,
          x: 12,
          y: 12,
          width: Math.max(1, Math.min(owner.width - 24, 48)),
          height: Math.max(1, Math.min(owner.height - 24, 24)),
          fills: []
        })
        createSlotProperty(ctx.graph, frame.id, id)
      })
      setBehaviour(owner.id, { ...behaviour, parts: { ...behaviour.parts, [partId]: id } })
    })
    return id
  }

  return { addBehaviourText, addBehaviourVariant, addBehaviourPart }
}
