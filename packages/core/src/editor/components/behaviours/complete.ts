import {
  createComponentPropertyId,
  createSlotProperty,
  INTERACTION_STATES,
  readBehaviour,
  type Behaviour,
  type InteractionState,
  type SceneNode
} from '@open-pencil/scene-graph'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import { VARIANT_SET_PADDING, variantSetProps } from '#core/editor/components/variant-set'
import type { createVariantActions } from '#core/editor/components/variants'
import { wrapSelectionInContainer } from '#core/editor/structure/container-wrap'
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

/** The variant value a new states property draws each interaction state with. */
const STATE_VALUES: Record<InteractionState, string> = {
  rest: 'Default',
  hover: 'Hover',
  pressed: 'Pressed',
  focus: 'Focus',
  disabled: 'Disabled'
}
/** Names tried, in order, for a new states property, skipping ones the set already has. */
const STATE_PROPERTY_NAMES = ['State', 'Interaction', 'Interaction state']
/** Space between variants in a set laid out as a grid. */
const SET_GAP = 20

/**
 * Lay a set's variants out as rows, one per variant it had, each followed by its new state
 * copies, and fit the set around them, as one undo step.
 */
function layOutRows(ctx: EditorContext, setId: string, rows: string[][]): void {
  const nodes = rows.map((row) => row.flatMap((id) => ctx.graph.getNode(id) ?? []))
  const width = Math.max(...nodes.flat().map((node) => node.width))
  const ids = [setId, ...nodes.flat().map((node) => node.id)]
  const capture = () =>
    ids.flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node ? [{ id, x: node.x, y: node.y, width: node.width, height: node.height }] : []
    })
  const before = capture()
  let y = VARIANT_SET_PADDING
  for (const row of nodes) {
    for (const [column, node] of row.entries())
      ctx.graph.updateNode(node.id, { x: VARIANT_SET_PADDING + column * (width + SET_GAP), y })
    y += Math.max(...row.map((node) => node.height)) + SET_GAP
  }
  const columns = Math.max(...nodes.map((row) => row.length))
  ctx.graph.updateNode(setId, {
    width: VARIANT_SET_PADDING * 2 + columns * width + (columns - 1) * SET_GAP,
    height: y - SET_GAP + VARIANT_SET_PADDING
  })
  const after = capture()
  const apply = (frames: typeof before) => {
    for (const { id, ...frame } of frames) ctx.graph.updateNode(id, frame)
    ctx.requestRender()
  }
  ctx.undo.push({
    label: 'Arrange variants',
    forward: () => apply(after),
    inverse: () => apply(before)
  })
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
   * Add a property under a new id inside a behaviour's owner and bind it, as one undo step:
   * `create` edits the owner's layers, and `bind` returns the behaviour holding the new id.
   */
  function createAndBind(
    ownerId: string,
    label: string,
    create: (owner: SceneNode, id: string) => void,
    bind: (behaviour: Behaviour, id: string) => Behaviour
  ): string | null {
    const found = owned(ownerId)
    if (!found) return null
    const { owner, behaviour } = found
    const id = createComponentPropertyId()
    ctx.undo.runBatch(label, () => {
      recordSubtreeEdit(ctx, label, owner.id, () => create(owner, id))
      setBehaviour(owner.id, bind(behaviour, id))
    })
    return id
  }

  /**
   * Show a text value through a new text property named `name`. Each variant's first text
   * layer that no property shows becomes its target; a variant without one gets a new text
   * layer inset in it.
   */
  function addBehaviourText(ownerId: string, valueId: string, name: string): string | null {
    return createAndBind(
      ownerId,
      `Add ${name} text`,
      (owner, id) => {
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
      },
      (behaviour, id) => ({
        ...behaviour,
        texts: { ...behaviour.texts, [valueId]: { propertyId: id } }
      })
    )
  }

  /**
   * Hold a boolean value in a new variant property `name` with values Off and On: every
   * variant is drawn Off, and a copy of each is added drawn On, ready to restyle. A lone main
   * component first becomes the only variant of a new set.
   */
  function addBehaviourVariant(ownerId: string, valueId: string, name: string): string | null {
    const found = owned(ownerId)
    if (!found) return null
    return ctx.undo.runBatch(`Add ${name} variants`, () => {
      const set = ownSet(found.owner, found.behaviour)
      const id = set && variants.addPropertyDefinition(set.id, name, 'VARIANT', 'Off')
      if (!set || !id) return null
      const rows = variantsOf(ctx, set).map((variant) => {
        const copy = variants.duplicateVariant(variant.id)
        if (copy) variants.setVariantPropertyValue(copy, id, 'On')
        return copy ? [variant.id, copy] : [variant.id]
      })
      layOutRows(ctx, set.id, rows)
      const behaviour = readBehaviour(ctx.graph.getNode(set.id) ?? set) ?? found.behaviour
      setBehaviour(set.id, {
        ...behaviour,
        booleans: { ...behaviour.booleans, [valueId]: { propertyId: id, on: 'On', off: 'Off' } }
      })
      ctx.setSelectedIds(new Set([set.id]))
      return id
    })
  }

  /**
   * Make a new frame the slot for a part named `name`: in the main component, or in each
   * variant of a set, all under one slot id so the part is the same slot in every state.
   */
  function addBehaviourPart(ownerId: string, partId: string, name: string): string | null {
    return createAndBind(
      ownerId,
      `Add ${name} slot`,
      (owner, id) => {
        for (const variant of variantsOf(ctx, owner)) {
          const frame = ctx.graph.createNode('FRAME', variant.id, {
            name,
            x: 12,
            y: 12,
            width: Math.max(1, Math.min(variant.width - 24, 48)),
            height: Math.max(1, Math.min(variant.height - 24, 24)),
            fills: []
          })
          createSlotProperty(ctx.graph, frame.id, id)
        }
      },
      (behaviour, id) => ({ ...behaviour, parts: { ...behaviour.parts, [partId]: id } })
    )
  }

  /**
   * The set a behaviour's owner draws its variants in: the owner itself, or, for a lone main
   * component, a new set it becomes the only variant of, which takes over the behaviour.
   */
  function ownSet(owner: SceneNode, behaviour: Behaviour): SceneNode | undefined {
    if (owner.type === 'COMPONENT_SET') return owner
    const component = owner
    const parentId = component.parentId ?? ctx.state.currentPageId
    const setId = wrapSelectionInContainer(
      ctx,
      'COMPONENT_SET',
      [component],
      variantSetProps(ctx.graph, [component], parentId, 'canvas')
    )
    if (!setId) return undefined
    setBehaviour(component.id, null)
    setBehaviour(setId, behaviour)
    return ctx.graph.getNode(setId)
  }

  /**
   * Give a control its interaction states: a new variant property with Default, Hover,
   * Pressed, Focus, and Disabled, a copy of each variant for every state but Default, ready to
   * restyle, and the behaviour's states bound to it. A lone main component first becomes the
   * only variant of a new set. Returns the new property's id.
   */
  function addBehaviourStates(ownerId: string): string | null {
    const found = owned(ownerId)
    if (!found) return null
    return ctx.undo.runBatch('Add states', () => {
      const set = ownSet(found.owner, found.behaviour)
      if (!set) return null
      const taken = new Set(set.componentPropertyDefinitions.map((item) => item.name))
      const name = STATE_PROPERTY_NAMES.find((item) => !taken.has(item))
      const id = name && variants.addPropertyDefinition(set.id, name, 'VARIANT', STATE_VALUES.rest)
      if (!id) return null
      const others = INTERACTION_STATES.filter((state) => state !== 'rest')
      const rows = variantsOf(ctx, set).map((variant) => [
        variant.id,
        ...others.flatMap((state) => {
          const copy = variants.duplicateVariant(variant.id)
          if (copy) variants.setVariantPropertyValue(copy, id, STATE_VALUES[state])
          return copy ?? []
        })
      ])
      layOutRows(ctx, set.id, rows)
      const behaviour = readBehaviour(ctx.graph.getNode(set.id) ?? set) ?? found.behaviour
      setBehaviour(set.id, { ...behaviour, states: { propertyId: id, ...STATE_VALUES } })
      ctx.setSelectedIds(new Set([set.id]))
      return id
    })
  }

  return { addBehaviourText, addBehaviourVariant, addBehaviourPart, addBehaviourStates }
}
