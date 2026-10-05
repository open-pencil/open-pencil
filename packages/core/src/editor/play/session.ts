import {
  applyComponentPropertyValue,
  behaviourOwner,
  behaviourProperties,
  booleanBinding,
  instanceMainComponent,
  instanceSlotFrames,
  numberSettings,
  readBehaviour,
  SceneGraph,
  slotPropertyId,
  type Behaviour,
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

/**
 * The control an instance behaves as: the nearest instance at or above `nodeId` whose main
 * component (or its set) has a behaviour.
 */
export function playTarget(graph: SceneGraph, nodeId: string): PlayTarget | null {
  let current = graph.getNode(nodeId)
  while (current && current.type !== 'CANVAS') {
    if (current.type === 'INSTANCE') {
      const component = instanceMainComponent(graph, current)
      const owner = component && behaviourOwner(graph, component)
      const behaviour = owner && readBehaviour(owner)
      if (owner && behaviour) return { instance: current, owner, behaviour }
    }
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return null
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

  /** The component of the set whose values match the instance's but for one property. */
  function variantWith(
    instance: SceneNode,
    property: string,
    value: string
  ): SceneNode | undefined {
    const current = instanceMainComponent(copies, instance)
    const set = current?.parentId ? copies.getNode(current.parentId) : undefined
    if (!current || set?.type !== 'COMPONENT_SET') return undefined
    const wanted = { ...current.componentPropertyValues, [property]: value }
    return copies
      .getChildren(set.id)
      .find(
        (variant) =>
          variant.type === 'COMPONENT' &&
          Object.entries(wanted).every(
            ([key, item]) => variant.componentPropertyValues[key] === item
          )
      )
  }

  function getBoolean(target: PlayTarget, valueId: string): boolean {
    const key = `${target.instance.id}:${valueId}`
    const known = booleans.get(key)
    if (known !== undefined) return known
    const binding = booleanBinding(target.behaviour, valueId)
    const definition = behaviourProperties(source, target.owner).find(
      (item) => item.id === binding?.propertyId
    )
    if (!binding || !definition) return false
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

  /** Turn a boolean value on or off: switch the copy's variant, or set its boolean property. */
  function setBoolean(target: PlayTarget, valueId: string, on: boolean): void {
    const binding = booleanBinding(target.behaviour, valueId)
    const definition = behaviourProperties(source, target.owner).find(
      (item) => item.id === binding?.propertyId
    )
    const copy = touch(target)
    if (!binding || !definition || !copy) return
    if (definition.type === 'BOOLEAN') {
      applyComponentPropertyValue(copies, copy.id, definition, String(on))
    } else {
      const value = on ? binding.on : binding.off
      const variant = value ? variantWith(copy, definition.name, value) : undefined
      if (variant) copies.swapInstanceComponent(copy.id, variant.id)
    }
    computeLayout(copies, copy.id)
    booleans.set(`${target.instance.id}:${valueId}`, on)
  }

  /** The copy's slot frame bound to a part of the behaviour. */
  function partFrame(target: PlayTarget, copy: SceneNode, partId: string): SceneNode | undefined {
    const propertyId = target.behaviour.parts[partId]
    return propertyId
      ? instanceSlotFrames(copies, copy).find((frame) => slotPropertyId(frame) === propertyId)
      : undefined
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
    numbers.clear()
    choices.clear()
  }

  return {
    substitutes,
    edit,
    partFrame,
    getBoolean,
    setBoolean,
    getNumber,
    setNumber,
    getChoice,
    setChoice,
    reset
  }
}

export type PlaySession = ReturnType<typeof createPlaySession>
