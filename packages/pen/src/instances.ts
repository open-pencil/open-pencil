import { pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import { generateId, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  detachInstance,
  findInstanceAncestor,
  INSTANCE_OVERRIDE_FIELDS,
  populateInstanceChildren,
  recordInstanceOverride,
  swapInstanceComponent
} from '@open-pencil/scene-graph/instances'
import { getInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { isNumericVariableBindingField } from '@open-pencil/scene-graph/variables'

import { applyPenProperties, createSceneNode, fieldsSetBy, type Build } from './nodes'
import type { PenNode, PenOverride } from './schema'

/** Fills an instance read from `.pen`, after the instances inside its component. */
type Populate = (id: string) => void

/** Adds `start` and the layers it was copied from, nearest first. */
function addSourceChain(graph: SceneGraph, found: Set<string>, start: string | null): void {
  let id = start
  while (id && !found.has(id)) {
    found.add(id)
    id = graph.getNode(id)?.componentId ?? null
  }
}

/**
 * The layer a swapped copy was made from, recorded on the instance that holds it. A theme re-read
 * swaps an icon onto the glyph component for that theme and replaces `componentId`, so a path that
 * names the original layer has to follow this link, including through copies of copies.
 */
function swappedSource(graph: SceneGraph, node: SceneNode): string | null {
  const owner = node.parentId ? findInstanceAncestor(graph, node.parentId) : undefined
  if (!owner) return null
  const recorded = getInstanceOverride(
    owner.instanceOverrides,
    owner.id,
    node.id,
    'sourceComponentId'
  )
  return typeof recorded === 'string' ? recorded : null
}

/** The layers a copy was made from, nearest first, through copies of copies. */
function sources(graph: SceneGraph, node: SceneNode): Set<string> {
  const found = new Set<string>()
  addSourceChain(graph, found, node.componentId)
  addSourceChain(graph, found, swappedSource(graph, node))
  return found
}

/** The copy in `root`'s layers made from the pen.dev layer `sourceId`, at any depth. */
function findCopy(graph: SceneGraph, root: SceneNode, sourceId: string): SceneNode | undefined {
  const queue = graph.getChildren(root.id)
  for (const node of queue) {
    if (sources(graph, node).has(sourceId)) return node
    for (const child of graph.getChildren(node.id)) queue.push(child)
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

/** A theme laid over another, axis by axis. The one on top wins where both set an axis. */
function mergeTheme(
  base: Record<string, string> | undefined,
  overlay: Record<string, string>
): Record<string, string> {
  return { ...base, ...overlay }
}

/** The themes from the page down through `id`, as each layer was read. */
function themesThrough(build: Build, id: string): Record<string, string>[] {
  const ids: string[] = []
  for (
    let current: string | null = id;
    current;
    current = build.graph.getNode(current)?.parentId ?? null
  ) {
    ids.push(current)
  }
  const chain: Record<string, string>[] = []
  for (const layerId of ids.toReversed()) {
    const theme = build.effective.get(layerId)?.theme
    if (theme) chain.push(theme)
  }
  return chain
}

/** Runs `apply` in the merged theme of a layer's ancestors, as the layer was read in. */
export function inAncestorThemes<T>(build: Build, node: SceneNode, apply: () => T): T {
  const leave = (node.parentId ? themesThrough(build, node.parentId) : []).map((theme) =>
    build.ctx.enterTheme(theme)
  )
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
  const { ref: _ref, type: _type, id: _id, descendants, ...own } = replacement
  // The replacement's theme is part of the theme its copies are read in, as a ref's theme is.
  const theme = own.theme ? mergeTheme(fields.theme, own.theme) : fields.theme
  effective.set(
    target.id,
    theme ? { ...fields, id: target.id, theme } : { ...fields, id: target.id }
  )
  inheritCopyFields(build, target, descendantThemes(build, target, descendants))
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
  // A theme names axes. It merges over the layer's own, as a ref's theme does.
  if (fields.theme) merged.theme = mergeTheme(base.theme, fields.theme)
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

/**
 * Whether a sync resolves `field` again from its binding in the copy's mode. A number and a paint
 * colour do; a clip does not, so a theme that changed it has to be kept as an override.
 */
function syncResolvesBinding(node: SceneNode, field: string): boolean {
  if (
    (field === 'fills' || field === 'strokes') &&
    Object.keys(node.boundVariables).some((key) => key.startsWith(`${field}/`))
  ) {
    return true
  }
  return isNumericVariableBindingField(field) && Object.hasOwn(node.boundVariables, field)
}

/**
 * Records what a theme re-read changed on `copy` and a sync would not resolve again. The re-read
 * runs before an override snapshots the copy, so the snapshot already holds the new clip and would
 * record only the theme axes.
 */
function recordThemeResolvedFields(
  graph: SceneGraph,
  copy: SceneNode,
  before: Partial<SceneNode>
): void {
  const changed = INSTANCE_OVERRIDE_FIELDS.filter(
    (field) => !isEqual(before[field], copy[field]) && !syncResolvesBinding(copy, field)
  )
  recordInstanceOverride(graph, copy.id, changed)
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

/**
 * Themes descendant overrides set on copies inside `instance`, by that copy. A copy is read
 * before those overrides apply, so a theme one of them sets has to be on the copy already or the
 * layers under it are read in the theme from before the override.
 */
function descendantThemes(
  build: Build,
  instance: SceneNode,
  descendants: PenNode['descendants']
): Map<string, Record<string, string>> | undefined {
  if (!descendants) return undefined
  let themes: Map<string, Record<string, string>> | undefined
  for (const [path, override] of Object.entries(descendants)) {
    // A replacement is built in the override's theme; only an existing subtree needs it early.
    if (!override.theme || override.type || override.children) continue
    const target = resolvePath(build.graph, instance, path)
    if (!target) continue
    themes ??= new Map()
    themes.set(target.id, override.theme)
  }
  return themes
}

/**
 * Gives each copy inside `root` the pen.dev fields and placement of the layer it copies.
 * A copy is cloned from its source as that source was read, which may be outside the theme of
 * the screen this instance is placed in, so a copy in another theme is read again there.
 * `themes` merges a descendant override's theme over the copy it names, so the layers under that
 * copy are read in the theme the override leaves.
 */
function inheritCopyFields(
  build: Build,
  root: SceneNode,
  themes?: ReadonlyMap<string, Record<string, string>>
): void {
  const { graph, effective, placements, ctx } = build
  const copies = graph.getChildren(root.id)
  for (const copy of copies) {
    const source = copy.componentId
    const fields = source ? effective.get(source) : undefined
    const theme = themes?.get(copy.id)
    const pen = fields && theme ? { ...fields, theme: mergeTheme(fields.theme, theme) } : fields
    if (pen) effective.set(copy.id, pen)
    const placement = source ? placements.get(source) : undefined
    if (placement) placements.set(copy.id, placement)
    if (source && build.groupIds.has(source)) build.groupIds.add(copy.id)
    if (source && build.aroundIds.has(source)) build.aroundIds.add(copy.id)
    if (pen && source && !isEqual(themesThrough(build, copy.id), themesThrough(build, source))) {
      const before = structuredClone(pick(copy, INSTANCE_OVERRIDE_FIELDS))
      inAncestorThemes(build, copy, () => {
        const leave = pen.theme ? ctx.enterTheme(pen.theme) : undefined
        try {
          applyPenProperties(copy, pen, build)
        } finally {
          leave?.()
        }
      })
      recordThemeResolvedFields(graph, copy, before)
    }
    for (const child of graph.getChildren(copy.id)) copies.push(child)
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
    inheritCopyFields(build, instance, descendantThemes(build, instance, ref.descendants))
    applyDescendants(build, instance, ref.descendants, populate)
    // Before anything copies this instance, so the copies are of what it became.
    detachReplacingInstances(build)
  }

  // A replacement may hold instances of its own, which join the map as they are read.
  for (const id of instances.keys()) populate(id)
}
