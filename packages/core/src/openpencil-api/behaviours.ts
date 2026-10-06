import {
  behaviourFromSpec,
  behaviourOwner,
  behaviourToSpec,
  createComponentPropertyId,
  createSlotProperty,
  emptyBehaviour,
  missingBindings,
  readBehaviour,
  slotOwner,
  slotPropertyId,
  withBehaviour,
  type Behaviour,
  type BehaviourKind,
  type BehaviourNumberSettings,
  type BehaviourSpec,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

/** A node as scripts pass it: a Figma API node, or its id. */
export type NodeRef = { readonly id: string } | string

export function nodeOf(graph: SceneGraph, ref: NodeRef): SceneNode {
  const id = typeof ref === 'string' ? ref : ref.id
  const node = graph.getNode(id)
  if (!node) throw new Error(`No node ${id}`)
  return node
}

/** The component or component set that keeps a node's behaviour: a variant's set, or itself. */
function ownerOf(graph: SceneGraph, ref: NodeRef): SceneNode {
  const node = nodeOf(graph, ref)
  const owner = behaviourOwner(graph, node)
  if (!owner) throw new Error(`${node.name} is not a main component or component set`)
  return owner
}

/**
 * Make a frame of a main component a slot, as Create slot does, and return the slot property's
 * name; a frame that already is one keeps its slot.
 */
export function makeSlot(graph: SceneGraph, ref: NodeRef): string {
  const frame = nodeOf(graph, ref)
  if (!slotPropertyId(frame) && !createSlotProperty(graph, frame.id, createComponentPropertyId()))
    throw new Error(
      `${frame.name} cannot become a slot: it must be a frame inside a main component`
    )
  const id = slotPropertyId(nodeOf(graph, frame.id))
  const owner = slotOwner(graph, frame)
  return owner?.componentPropertyDefinitions.find((item) => item.id === id)?.name ?? frame.name
}

/**
 * A component's behaviour as scripts edit it, in the style of the Figma API: properties read the
 * current behaviour by name, and every change is written to the document at once.
 */
export class BehaviourHandle {
  constructor(
    private readonly graph: SceneGraph,
    private readonly ownerId: string
  ) {}

  private get owner(): SceneNode {
    return nodeOf(this.graph, this.ownerId)
  }

  private get stored(): Behaviour {
    const behaviour = readBehaviour(this.owner)
    if (!behaviour) throw new Error(`${this.owner.name} no longer has a behaviour`)
    return behaviour
  }

  private write(behaviour: Behaviour | null): void {
    this.graph.updateNode(this.ownerId, { pluginData: withBehaviour(this.owner, behaviour) })
  }

  private change(edit: (spec: BehaviourSpec) => BehaviourSpec): this {
    this.write(behaviourFromSpec(this.graph, this.owner, edit(this.spec)))
    return this
  }

  /** The id of the component or component set that keeps the behaviour. */
  get id(): string {
    return this.ownerId
  }

  get kind(): BehaviourKind {
    return this.stored.kind
  }

  /** The behaviour with properties and slots by name, as `openpencil.setBehaviour` takes it. */
  get spec(): BehaviourSpec {
    return behaviourToSpec(this.graph, this.owner, this.stored)
  }

  /** Required values and parts still unbound, by id, as the Behaviour section's chip counts them. */
  get missing(): string[] {
    return missingBindings(this.graph, this.owner, this.stored)
  }

  /** The variant property that draws interaction states, by name, or null for none. */
  get states(): string | null {
    const states = this.spec.states
    if (!states) return null
    return typeof states === 'string' ? states : states.property
  }

  set states(property: string | null) {
    this.change(({ states: _states, ...spec }) => (property ? { ...spec, states: property } : spec))
  }

  /**
   * Hold a boolean or text value in the property named `property`; for a variant property,
   * `on` and `off` name its values, guessed from names like On and Off when left out.
   */
  bindValue(valueId: string, property: string, values: { on?: string; off?: string } = {}): this {
    return this.change((spec) => ({
      ...spec,
      values: { ...spec.values, [valueId]: { property, ...values } }
    }))
  }

  /** Set a number value's range: its minimum, maximum, step, and default. */
  setNumber(valueId: string, settings: Partial<BehaviourNumberSettings>): this {
    return this.change((spec) => ({
      ...spec,
      numbers: { ...spec.numbers, [valueId]: { ...spec.numbers?.[valueId], ...settings } }
    }))
  }

  /**
   * Make a slot the part `partId`: a slot property by name, or a frame of the component, which
   * becomes a slot first if it is not one.
   */
  bindPart(partId: string, slot: NodeRef): this {
    const name =
      typeof slot === 'string' && !this.graph.getNode(slot) ? slot : makeSlot(this.graph, slot)
    return this.change((spec) => ({ ...spec, parts: { ...spec.parts, [partId]: name } }))
  }

  /** Remove the behaviour; the component keeps its properties and slots. */
  remove(): void {
    this.write(null)
  }

  toJSON() {
    return { id: this.id, ...this.spec, missing: this.missing }
  }
}

/** The behaviour a node's component keeps, or null when it has none. */
export function getBehaviour(graph: SceneGraph, ref: NodeRef): BehaviourHandle | null {
  const owner = ownerOf(graph, ref)
  return readBehaviour(owner) ? new BehaviourHandle(graph, owner.id) : null
}

/**
 * Give a main component or component set a behaviour, replacing any it has: a kind with
 * nothing bound yet, or a whole spec by name.
 */
export function setBehaviour(
  graph: SceneGraph,
  ref: NodeRef,
  spec: BehaviourKind | BehaviourSpec
): BehaviourHandle {
  const owner = ownerOf(graph, ref)
  const behaviour =
    typeof spec === 'string' ? emptyBehaviour(spec) : behaviourFromSpec(graph, owner, spec)
  graph.updateNode(owner.id, { pluginData: withBehaviour(owner, behaviour) })
  return new BehaviourHandle(graph, owner.id)
}
