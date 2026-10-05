import {
  applyComponentPropertyValue,
  behaviourContract,
  behaviourOwner,
  behaviourProperties,
  booleanBinding,
  findComponentPropertyTargets,
  instanceMainComponent,
  instanceSlotFrames,
  numberSettings,
  readBehaviour,
  SceneGraph,
  slotPropertyId,
  textBinding,
  type Behaviour,
  type ComponentPropertyDefinition,
  type InteractionState,
  type SceneNode
} from '@open-pencil/scene-graph'

import { computeLayout } from '#core/layout'

/** A node a previewing canvas draws in place of a document node, from the session's graph. */
export interface PlaySubstitute {
  graph: SceneGraph
  nodeId: string
}

/** An instance with a behaviour, as preview drives it. */
export interface PlayTarget {
  instance: SceneNode
  owner: SceneNode
  behaviour: Behaviour
}

/** The control an instance itself behaves as, if its main component (or set) has a behaviour. */
export function playControl(graph: SceneGraph, instance: SceneNode): PlayTarget | null {
  if (instance.type !== 'INSTANCE') return null
  const component = instanceMainComponent(graph, instance)
  const owner = component && behaviourOwner(graph, component)
  const behaviour = owner && readBehaviour(owner)
  return owner && behaviour ? { instance, owner, behaviour } : null
}

/** Whether `node` lies in one of the control's item slots, such as a radio group's radios. */
function holdsItem(graph: SceneGraph, control: PlayTarget, node: SceneNode): boolean {
  const itemSlots = new Set(
    behaviourContract(control.behaviour.kind)
      .parts.filter((part) => part.items)
      .flatMap((part) => control.behaviour.parts[part.id] ?? [])
  )
  if (itemSlots.size === 0) return false
  const frameIds = new Set(
    instanceSlotFrames(graph, control.instance)
      .filter((frame) => itemSlots.has(slotPropertyId(frame) ?? ''))
      .map((frame) => frame.id)
  )
  let current = node.parentId ? graph.getNode(node.parentId) : undefined
  while (current && current.id !== control.instance.id) {
    if (frameIds.has(current.id)) return true
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return false
}

/**
 * The control a node belongs to: the nearest instance at or above `nodeId` with a behaviour,
 * unless it is an item of an enclosing group (a radio of a radio group, a collapsible of an
 * accordion), in which case the group drives it.
 */
export function playTarget(graph: SceneGraph, nodeId: string): PlayTarget | null {
  let found: PlayTarget | null = null
  let current = graph.getNode(nodeId)
  while (current && current.type !== 'CANVAS') {
    const control = playControl(graph, current)
    if (control) {
      if (!found || holdsItem(graph, control, found.instance)) found = control
      else return found
    }
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return found
}

function subtreeIds(graph: SceneGraph, rootId: string): string[] {
  const ids: string[] = []
  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    ids.push(id)
    for (const child of node.childIds) visit(child)
  }
  visit(rootId)
  return ids
}

/**
 * The temporary state of a previewing canvas. The first time an instance is used, it is copied
 * with its component into a private graph that keeps the document's ids; the canvas draws the
 * copy in its place, so the document, undo, autosave, and collaborators never see preview.
 */
export function createPlaySession(source: SceneGraph) {
  let copies = new SceneGraph()
  const substitutes = new Map<string, PlaySubstitute>()
  const booleans = new Map<string, boolean>()
  const numbers = new Map<string, number>()
  const texts = new Map<string, string>()
  const choices = new Map<string, number>()

  function share(graph: SceneGraph) {
    // Fills, images, and bindings resolve against the document's own tables.
    graph.variables = source.variables
    graph.variableCollections = source.variableCollections
    graph.activeMode = source.activeMode
    graph.images = source.images
    graph.documentColorSpace = source.documentColorSpace
    return graph
  }
  share(copies)

  function copyIn(ids: readonly string[]) {
    for (const id of ids) {
      if (copies.nodes.has(id)) continue
      const node = source.getNode(id)
      if (!node) continue
      const copy = structuredClone(node)
      copies.nodes.set(id, copy)
      if (copy.type === 'INSTANCE' && copy.componentId) {
        const set = copies.instanceIndex.get(copy.componentId) ?? new Set<string>()
        set.add(id)
        copies.instanceIndex.set(copy.componentId, set)
      }
    }
  }

  /** The instance's copy, made on first use together with the component it switches between. */
  function touch(target: PlayTarget): SceneNode | undefined {
    const id = target.instance.id
    if (!substitutes.has(id)) {
      const component = instanceMainComponent(source, target.instance)
      const set = component?.parentId ? source.getNode(component.parentId) : undefined
      const componentRoot = set?.type === 'COMPONENT_SET' ? set.id : component?.id
      if (componentRoot) copyIn(subtreeIds(source, componentRoot))
      copyIn(subtreeIds(source, id))
      substitutes.set(id, { graph: copies, nodeId: id })
    }
    return copies.getNode(id)
  }

  /**
   * The variant of the instance's set with `property` set to `value` and every other value kept.
   * A property in `loose` may change when no variant keeps it: to its fallback value if one
   * exists, else to any, so turning a switch on while hovered still works when the set has no
   * hovered On variant.
   */
  function variantWith(
    instance: SceneNode,
    property: string,
    value: string,
    loose: Record<string, string | undefined> = {}
  ): SceneNode | undefined {
    const current = instanceMainComponent(copies, instance)
    const set = current?.parentId ? copies.getNode(current.parentId) : undefined
    if (!current || set?.type !== 'COMPONENT_SET') return undefined
    const values = current.componentPropertyValues
    const candidates = copies
      .getChildren(set.id)
      .filter(
        (variant) =>
          variant.type === 'COMPONENT' &&
          variant.componentPropertyValues[property] === value &&
          Object.entries(values).every(
            ([key, item]) =>
              key === property ||
              Object.hasOwn(loose, key) ||
              variant.componentPropertyValues[key] === item
          )
      )
    const keeps = (variant: SceneNode, wanted: Record<string, string | undefined>) =>
      Object.keys(loose).every((key) => variant.componentPropertyValues[key] === wanted[key])
    return (
      candidates.find((variant) => keeps(variant, values)) ??
      candidates.find((variant) => keeps(variant, loose)) ??
      candidates[0]
    )
  }

  /** The variant property that draws the instance's interaction states, if the behaviour has one. */
  function statesProperty(target: PlayTarget) {
    const states = target.behaviour.states
    const definition = states
      ? behaviourProperties(source, target.owner).find(
          (item) => item.id === states.propertyId && item.type === 'VARIANT'
        )
      : undefined
    if (!states || !definition) return null
    const authored = instanceMainComponent(source, target.instance)?.componentPropertyValues[
      definition.name
    ]
    return { name: definition.name, states, authored, rest: states.rest ?? authored }
  }

  /** Whether the instance is disabled: its disabled value is on, or it is drawn disabled. */
  function isDisabled(target: PlayTarget): boolean {
    if (getBoolean(target, 'disabled')) return true
    const property = statesProperty(target)
    return !!property?.states.disabled && property.authored === property.states.disabled
  }

  /**
   * Show the instance in an interaction state by switching its copy's variant; a state the
   * behaviour has no value for shows the rest value. Returns whether the copy changed variant.
   */
  function setInteraction(target: PlayTarget, state: InteractionState): boolean {
    const property = statesProperty(target)
    const value = property ? (property.states[state] ?? property.rest) : undefined
    if (!property || !value) return false
    if (state === 'rest' && !substitutes.has(target.instance.id)) return false
    const copy = touch(target)
    const current = copy && instanceMainComponent(copies, copy)
    if (!copy || current?.componentPropertyValues[property.name] === value) return false
    const variant = variantWith(copy, property.name, value)
    if (!variant) return false
    copies.swapInstanceComponent(copy.id, variant.id)
    reapplyProperties(target, copy)
    computeLayout(copies, copy.id)
    return true
  }

  /**
   * Boolean and text properties set in preview, set again after a variant switch rebuilt the
   * copy.
   */
  function reapplyProperties(target: PlayTarget, copy: SceneNode): void {
    for (const valueId of Object.keys(target.behaviour.texts)) {
      const text = texts.get(`${target.instance.id}:${valueId}`)
      const definition = textDefinition(target, valueId)
      if (text !== undefined && definition) applyProperty(copy, definition, text)
    }
    for (const [valueId, binding] of Object.entries(target.behaviour.booleans)) {
      const on = booleans.get(`${target.instance.id}:${valueId}`)
      const definition = behaviourProperties(source, target.owner).find(
        (item) => item.id === binding.propertyId && item.type === 'BOOLEAN'
      )
      if (on !== undefined && definition) applyProperty(copy, definition, String(on))
    }
  }

  /** A boolean value: as set in preview, else as the instance draws it, else `fallback`. */
  function getBoolean(target: PlayTarget, valueId: string, fallback = false): boolean {
    const key = `${target.instance.id}:${valueId}`
    const known = booleans.get(key)
    if (known !== undefined) return known
    const binding = booleanBinding(target.behaviour, valueId)
    const definition = behaviourProperties(source, target.owner).find(
      (item) => item.id === binding?.propertyId
    )
    if (!binding || !definition) return fallback
    if (definition.type === 'BOOLEAN') {
      const assignments = target.instance.componentPropertyAssignments
      const value = Object.hasOwn(assignments, definition.id)
        ? assignments[definition.id]
        : definition.defaultValue
      return value === 'true'
    }
    return (
      instanceMainComponent(source, target.instance)?.componentPropertyValues[definition.name] ===
      binding.on
    )
  }

  /**
   * Turn a boolean value on or off: switch the copy's variant, or set its boolean property. An
   * unbound value is still remembered, for controls that draw it themselves (a collapsible).
   */
  function setBoolean(target: PlayTarget, valueId: string, on: boolean): void {
    booleans.set(`${target.instance.id}:${valueId}`, on)
    const binding = booleanBinding(target.behaviour, valueId)
    const definition = behaviourProperties(source, target.owner).find(
      (item) => item.id === binding?.propertyId
    )
    const copy = touch(target)
    if (!binding || !definition || !copy) return
    if (definition.type === 'BOOLEAN') {
      applyProperty(copy, definition, String(on))
    } else {
      const value = on ? binding.on : binding.off
      const property = statesProperty(target)
      const loose = property ? { [property.name]: property.rest } : {}
      const variant = value ? variantWith(copy, definition.name, value, loose) : undefined
      if (variant) copies.swapInstanceComponent(copy.id, variant.id)
    }
    if (definition.type !== 'BOOLEAN') reapplyProperties(target, copy)
    computeLayout(copies, copy.id)
  }

  /** The text property a text value is bound to. */
  function textDefinition(target: PlayTarget, valueId: string) {
    const propertyId = textBinding(target.behaviour, valueId)
    return behaviourProperties(source, target.owner).find(
      (item) => item.id === propertyId && item.type === 'TEXT'
    )
  }

  /** A text value: as typed in preview, else as the instance shows it. */
  function getText(target: PlayTarget, valueId: string): string {
    return texts.get(`${target.instance.id}:${valueId}`) ?? designedText(target, valueId)
  }

  /** A text value as the instance shows it in the document. */
  function designedText(target: PlayTarget, valueId: string): string {
    const definition = textDefinition(target, valueId)
    if (!definition) return ''
    const assignments = target.instance.componentPropertyAssignments
    return Object.hasOwn(assignments, definition.id)
      ? assignments[definition.id]
      : definition.defaultValue
  }

  /** Show text in the copy through its text property, and remember it. */
  function setText(target: PlayTarget, valueId: string, text: string): void {
    texts.set(`${target.instance.id}:${valueId}`, text)
    const definition = textDefinition(target, valueId)
    const copy = touch(target)
    if (!definition || !copy) return
    applyProperty(copy, definition, text)
    computeLayout(copies, copy.id)
  }

  /** The copy's slot frame bound to a part of the behaviour. */
  function partFrame(target: PlayTarget, copy: SceneNode, partId: string): SceneNode | undefined {
    const propertyId = target.behaviour.parts[partId]
    return propertyId
      ? instanceSlotFrames(copies, copy).find((frame) => slotPropertyId(frame) === propertyId)
      : undefined
  }

  /**
   * Let auto layout size a changed layer's copied ancestors again. Layers from a `.fig` file keep
   * the sizes Figma computed, which no longer hold once preview shows, hides, or retypes a layer.
   */
  function reflow(nodeId: string): void {
    let current = copies.getNode(nodeId)
    while (current) {
      if (current.derivedLayout) copies.updateNode(current.id, { derivedLayout: null })
      current = current.parentId ? copies.getNode(current.parentId) : undefined
    }
  }

  /** Set a component property on the copy, letting the layers it changes resize their parents. */
  function applyProperty(copy: SceneNode, definition: ComponentPropertyDefinition, value: string) {
    for (const item of findComponentPropertyTargets(copies, copy, definition.id))
      reflow(item.node.id)
    applyComponentPropertyValue(copies, copy.id, definition, value)
  }

  /**
   * Change the instance's copy: `change` gets the copies' graph and the copy, made on first use,
   * and the copy's layout is recomputed afterwards.
   */
  function edit(target: PlayTarget, change: (graph: SceneGraph, copy: SceneNode) => void): void {
    const copy = touch(target)
    if (!copy) return
    change(copies, copy)
    computeLayout(copies, copy.id)
  }

  function getNumber(target: PlayTarget, valueId: string): number {
    return (
      numbers.get(`${target.instance.id}:${valueId}`) ??
      numberSettings(target.behaviour, valueId)?.default ??
      0
    )
  }

  /** Remember a number value, stepped and clamped to its range, and return what was kept. */
  function setNumber(target: PlayTarget, valueId: string, value: number): number | null {
    const settings = numberSettings(target.behaviour, valueId)
    if (!settings) return null
    const stepped =
      settings.step > 0
        ? Math.round((value - settings.min) / settings.step) * settings.step + settings.min
        : value
    const clamped = Math.min(settings.max, Math.max(settings.min, stepped))
    numbers.set(`${target.instance.id}:${valueId}`, clamped)
    return clamped
  }

  /** A number or choice value set in preview, or undefined while it is still as designed. */
  function changed(target: PlayTarget, valueId: string): number | undefined {
    const key = `${target.instance.id}:${valueId}`
    return numbers.get(key) ?? choices.get(key)
  }

  /** A boolean value set in preview, or undefined while it is still as designed. */
  function changedBoolean(target: PlayTarget, valueId: string): boolean | undefined {
    return booleans.get(`${target.instance.id}:${valueId}`)
  }

  function getChoice(target: PlayTarget, valueId: string): number {
    return choices.get(`${target.instance.id}:${valueId}`) ?? 0
  }

  function setChoice(target: PlayTarget, valueId: string, index: number): void {
    choices.set(`${target.instance.id}:${valueId}`, index)
  }

  /** Forget every copy and state; the canvas draws the document again. */
  function reset(): void {
    copies = share(new SceneGraph())
    substitutes.clear()
    booleans.clear()
    texts.clear()
    numbers.clear()
    choices.clear()
  }

  return {
    substitutes,
    edit,
    reflow,
    isDisabled,
    setInteraction,
    partFrame,
    getBoolean,
    setBoolean,
    changed,
    changedBoolean,
    getText,
    designedText,
    setText,
    getNumber,
    setNumber,
    getChoice,
    setChoice,
    reset
  }
}

export type PlaySession = ReturnType<typeof createPlaySession>
