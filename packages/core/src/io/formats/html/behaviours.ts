import * as v from 'valibot'

import {
  bindPart,
  createScope,
  finishBehaviour,
  rekaRole,
  type RekaScope
} from '@open-pencil/design-jsx'
import type { DesignElement } from '@open-pencil/dom-css'
import { COMPONENT_ATTRIBUTES, type LayerSources } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { behaviourOwner, behaviourSpecSchema } from '@open-pencil/scene-graph/behaviours'
import { slotOwner } from '@open-pencil/scene-graph/slots'

/** `data-op-behaviour`: a behaviour spec without its kind, which the root's mark gives. */
const markedSpecSchema = v.pipe(v.string(), v.parseJson(), v.omit(behaviourSpecSchema, ['kind']))

type Spec = v.InferOutput<typeof markedSpecSchema>

/** A control the page marks: the Reka namespace of its root, what it binds, and its parts. */
interface MarkedControl {
  namespace: string
  scope: RekaScope
  spec: Spec
  /** The `data-op-behaviour` text it was given, which every variant must repeat. */
  written: string | undefined
}

/** Each layer the page marks with a Reka element, once: a text layer shares its box's element. */
function rekaMarked(graph: SceneGraph, sources: LayerSources) {
  const found: { node: SceneNode; element: DesignElement; type: string }[] = []
  for (const [nodeId, element] of sources) {
    const type = element.attrs[COMPONENT_ATTRIBUTES.reka]?.trim()
    const node = type ? graph.getNode(nodeId) : undefined
    const parent = node?.parentId ? sources.get(node.parentId) : undefined
    if (type && node && parent !== element) found.push({ node, element, type })
  }
  return found
}

function readSpec(type: string, written: string | undefined): Spec {
  if (written === undefined) return {}
  const parsed = v.safeParse(markedSpecSchema, written)
  if (!parsed.success)
    throw new Error(`The behaviour of <${type}> is not a behaviour: ${v.summarize(parsed.issues)}`)
  return parsed.output
}

function namespaceOf(type: string): string {
  return type.slice(0, type.indexOf('.'))
}

type Marked = ReturnType<typeof rekaMarked>[number]

/** The controls the marked roots make, by the component or set that keeps each behaviour. */
function markedControls(graph: SceneGraph, marked: readonly Marked[]): Map<string, MarkedControl> {
  const controls = new Map<string, MarkedControl>()
  for (const { node, element, type } of marked) {
    const role = rekaRole(type)
    if (!role) throw new Error(`<${type}> is no Reka UI element`)
    if (role.role !== 'root') continue
    const owner = behaviourOwner(graph, node)
    if (!owner) throw new Error(`<${type}> must be marked as a component too`)
    const written = element.attrs[COMPONENT_ATTRIBUTES.behaviour]
    const known = controls.get(owner.id)
    if (known && (known.scope.kind !== role.kind || known.written !== written)) {
      throw new Error(`The variants of ${owner.name} mark different controls or bindings`)
    }
    if (known) continue
    controls.set(owner.id, {
      namespace: namespaceOf(type),
      scope: createScope(role.kind, owner.id),
      spec: readSpec(type, written),
      written
    })
  }
  return controls
}

/** Makes a marked part the slot that draws it in its control, named after it. */
function bindMarkedPart(
  graph: SceneGraph,
  controls: ReadonlyMap<string, MarkedControl>,
  { node, type }: Marked
): void {
  const role = rekaRole(type)
  if (role?.role === 'root' || role?.role === 'frame') return
  const owner = slotOwner(graph, node)
  const control = owner ? controls.get(owner.id) : undefined
  if (!control || control.namespace !== namespaceOf(type)) {
    throw new Error(`<${type}> must be inside a component marked ${namespaceOf(type)}.Root`)
  }
  if (role?.role !== 'part') throw new Error(`<${type}> is not read from HTML yet`)
  if (node.type !== 'FRAME') throw new Error(`<${type}> needs an element with a box`)
  graph.updateNode(node.id, { name: type.slice(type.indexOf('.') + 1) })
  bindPart(graph, control.scope, node, role.part)
}

/**
 * Makes the components the page marks with a Reka UI root behave as that control, as Design JSX
 * does for its Reka elements: the root's component, or the set its variants are in, keeps the
 * behaviour, and each box marked as a part of it becomes the slot that draws that part, named
 * after it. Every variant of a set must mark the same control with the same bindings.
 */
export function applyMarkedBehaviours(graph: SceneGraph, sources: LayerSources): void {
  const marked = rekaMarked(graph, sources)
  const controls = markedControls(graph, marked)
  for (const each of marked) bindMarkedPart(graph, controls, each)
  for (const { scope, spec } of controls.values()) {
    finishBehaviour(graph, scope, { ...spec, kind: scope.kind })
  }
}
