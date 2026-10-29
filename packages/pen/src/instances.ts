import { pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import { generateId, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  detachInstance,
  INSTANCE_OVERRIDE_FIELDS,
  populateInstanceChildren,
  recordInstanceOverride,
  swapInstanceComponent
} from '@open-pencil/scene-graph/instances'

import { applyPenProperties, createSceneNode, fieldsSetBy, type Build } from './nodes'
import type { PenNode, PenOverride } from './schema'

/** Fills an instance read from `.pen`, after the instances inside its component. */
type Populate = (id: string) => void

/** The layers a copy was made from, nearest first, through copies of copies. */
function sources(graph: SceneGraph, node: SceneNode): Set<string> {
  const found = new Set<string>()
  for (
    let id = node.componentId;
    id && !found.has(id);
    id = graph.getNode(id)?.componentId ?? null
  ) {
    found.add(id)
  }
  return found
}

/** The copy in `root`'s layers made from the pen.dev layer `sourceId`, at any depth. */
function findCopy(graph: SceneGraph, root: SceneNode, sourceId: string): SceneNode | undefined {
  const queue = graph.getChildren(root.id)
  for (const node of queue) {
    if (sources(graph, node).has(sourceId)) return node
    queue.push(...graph.getChildren(node.id))
  }
  return undefined
}

/**
 * The layer an override's key names: pen.dev IDs separated by `/`, each one inside the copy of the
 * instance the one before it names.
 */
function resolvePath(graph: SceneGraph, instance: SceneNode, path: string): SceneNode | undefined {
  let current: SceneNode | undefined = instance
  for (const id of path.split('/')) {
    current = current ? findCopy(graph, current, id) : undefined
  }
  return current
}

/** Runs `apply` in the merged theme of a layer's ancestors, as the layer was read in. */
export function inAncestorThemes<T>(build: Build, node: SceneNode, apply: () => T): T {
  const chain: Record<string, string>[] = []
  for (let id = node.parentId; id; id = build.graph.getNode(id)?.parentId ?? null) {
    const theme = build.effective.get(id)?.theme
    if (theme) chain.unshift(theme)
  }
  const leave = chain.map((theme) => build.ctx.enterTheme(theme))
  try {
    return apply()
  } finally {
    for (const exit of leave.toReversed()) exit()
  }
}

function replaceLayer(
  build: Build,
  target: SceneNode,
  replacement: PenOverride,
  populate: Populate
): void {
  const { graph } = build
  const parentId = target.parentId
  if (!parentId) return
  if (swapLayer(build, target, replacement, populate)) return
  const index = graph.getNode(parentId)?.childIds.indexOf(target.id) ?? -1
  const pen: PenNode = {
    ...replacement,
    type: replacement.type ?? 'frame',
    id: replacement.id ?? generateId()
  }
  inAncestorThemes(build, target, () => {
    graph.deleteNode(target.id)
    const id = createSceneNode(pen, parentId, build)
    if (id && index >= 0) graph.insertChildAt(id, parentId, index)
    // The parent's layers changed; a replacement that is itself an instance stays one.
    if (id) build.replaced.add(parentId)
  })
}

/**
 * Swaps a nested instance an override replaces with an instance of another component for that
 * component, as Figma's instance swap does, so the instances holding it stay instances. The
 * replacement's own fields and overrides then apply to the swapped layer. Returns whether it
 * swapped; any other replacement changes the layers of the instance holding it.
 */
function swapLayer(
  build: Build,
  target: SceneNode,
  replacement: PenOverride,
  populate: Populate
): boolean {
  const { graph, effective, instances } = build
  const component =
    typeof replacement.ref === 'string' ? build.components.get(replacement.ref) : undefined
  if (target.type !== 'INSTANCE' || replacement.type !== 'ref' || component?.type !== 'frame')
    return false
  for (const nested of instances.keys()) {
    if (graph.isDescendant(nested, component.id)) populate(nested)
  }
  swapInstanceComponent(graph, target.id, component.id)
  if (graph.getNode(target.id)?.componentId !== component.id) return false
  const {
    children: _children,
    reusable: _reusable,
    descendants: _descendants,
    ...fields
  } = component
  effective.set(target.id, { ...fields, id: target.id })
  inheritCopyFields(build, target)
  const { ref: _ref, type: _type, id: _id, descendants, ...own } = replacement
  overrideLayer(build, target, own)
  applyDescendants(build, target, descendants, populate)
  return true
}

/**
 * Records as the instance's overrides the fields an override set or changed on a copy, so they
 * survive the instance's next sync and a save, as an edit made in the editor would.
 */
function recordChangedFields(
  graph: SceneGraph,
  target: SceneNode,
  before: Partial<SceneNode>,
  override: PenOverride
): void {
  const changed = INSTANCE_OVERRIDE_FIELDS.filter((field) => !isEqual(before[field], target[field]))
  recordInstanceOverride(graph, target.id, [...changed, ...fieldsSetBy(override)])
}

/**
 * Records as the instance's own overrides the fields its `ref` sets or makes differ from its
 * component's. A size counts only when the `ref` sets it: otherwise it is the layout's, which
 * follows the component's.
 */
function recordOwnFields(graph: SceneGraph, instance: SceneNode, ref: PenNode): void {
  const component = instance.componentId ? graph.getNode(instance.componentId) : undefined
  if (!component) return
  const changed = INSTANCE_OVERRIDE_FIELDS.filter(
    (field) =>
      (field !== 'width' || 'width' in ref) &&
      (field !== 'height' || 'height' in ref) &&
      !isEqual(instance[field], component[field])
  )
  recordInstanceOverride(graph, instance.id, [...changed, ...fieldsSetBy(ref)])
}

function overrideLayer(build: Build, target: SceneNode, override: PenOverride): void {
  const { graph, ctx, effective } = build
  const base = effective.get(target.id) ?? { type: 'frame', id: target.id }
  const { descendants: _descendants, children, ...fields } = override
  const merged: PenNode = { ...base, ...fields, type: base.type, id: base.id }
  const before = structuredClone(pick(target, INSTANCE_OVERRIDE_FIELDS))
  inAncestorThemes(build, target, () => {
    const leave = merged.theme ? ctx.enterTheme(merged.theme) : undefined
    try {
      applyPenProperties(target, merged, build)
      recordChangedFields(graph, target, before, fields)
      if (children) {
        const replaced = target.childIds
        for (const childId of replaced) graph.deleteNode(childId)
        for (const child of children) createSceneNode(child, target.id, build)
        build.replaced.add(target.id)
      }
    } finally {
      leave?.()
    }
  })
}

/**
 * Detaches the instances holding a layer whose children an override replaced. An instance keeps
 * its component's layers, overriding their fields but never replacing them, so such an instance
 * becomes a frame that keeps what it shows, as detaching it in Figma does.
 */
function detachReplacingInstances(build: Build): void {
  const { graph } = build
  for (const id of build.replaced) {
    for (let node = graph.getNode(id); node;) {
      if (node.type === 'INSTANCE') detachInstance(graph, node.id)
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    }
  }
  build.replaced.clear()
}

/** Gives an instance's copies their overrides; a key with a `type` replaces the layer. */
function applyDescendants(
  build: Build,
  instance: SceneNode,
  descendants: PenNode['descendants'],
  populate: Populate
): void {
  for (const [path, override] of Object.entries(descendants ?? {})) {
    const target = resolvePath(build.graph, instance, path)
    if (!target) continue
    if (override.type) replaceLayer(build, target, override, populate)
    else overrideLayer(build, target, override)
  }
}

/** Gives each copy inside `root` the pen.dev fields and placement of the layer it copies. */
function inheritCopyFields(build: Build, root: SceneNode): void {
  const { graph, effective, placements } = build
  const copies = graph.getChildren(root.id)
  for (const copy of copies) {
    const source = copy.componentId
    const fields = source ? effective.get(source) : undefined
    if (fields) effective.set(copy.id, fields)
    const placement = source ? placements.get(source) : undefined
    if (placement) placements.set(copy.id, placement)
    if (source && build.groupIds.has(source)) build.groupIds.add(copy.id)
    if (source && build.aroundIds.has(source)) build.aroundIds.add(copy.id)
    copies.push(...graph.getChildren(copy.id))
  }
}

/**
 * Fills each instance with copies of its component's layers, then applies its overrides. An
 * instance inside a component is filled first, so the copies made of it carry its layers and
 * overrides; a copy keeps its source's pen.dev fields and placement.
 */
export function populateInstances(build: Build): void {
  const { graph, instances } = build
  const done = new Set<string>()

  function populate(id: string): void {
    if (done.has(id)) return
    done.add(id)
    const instance = graph.getNode(id)
    const ref = instances.get(id)
    if (!instance?.componentId || !ref) return
    const component = graph.getNode(instance.componentId)
    if (!component) return
    for (const nested of instances.keys()) {
      if (graph.isDescendant(nested, component.id)) populate(nested)
    }
    populateInstanceChildren(graph, instance.id, component.id)
    recordOwnFields(graph, instance, ref)
    inheritCopyFields(build, instance)
    applyDescendants(build, instance, ref.descendants, populate)
    // Before anything copies this instance, so the copies are of what it became.
    detachReplacingInstances(build)
  }

  // A replacement may hold instances of its own, which join the map as they are read.
  for (const id of instances.keys()) populate(id)
}
