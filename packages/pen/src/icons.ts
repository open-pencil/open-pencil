import { pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { readIconTint } from '@open-pencil/scene-graph/icons'
import {
  getInstances,
  INSTANCE_SYNC_PROPS,
  instanceMainComponent,
  populateInstanceChildren,
  recordInstanceOverride,
  swapInstanceComponent
} from '@open-pencil/scene-graph/instances'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { iconName, iconOptions } from './assets'
import type { Build } from './nodes'
import type { PenNode } from './schema'
import { resolveOptionalNumber, resolveString } from './variables'

/** Space between the icon components on their page. */
const ICON_COMPONENT_GAP = 16

/**
 * An icon draws its glyph in its fill colour, scaled to fit its box and centred, as pen.dev does;
 * an icon the host could not load is an empty frame. Its library, name, and weight may be
 * variables.
 */
export function drawIcon(node: SceneNode, pen: PenNode, build: Build): void {
  const { graph, ctx } = build
  const color = node.fills.find((fill) => fill.type === 'SOLID')?.color ?? { ...BLACK }
  node.fills = []
  for (const childId of node.childIds) graph.deleteNode(childId)
  const library = resolveString(pen.library, ctx)
  const icon = resolveString(pen.icon, ctx)
  const size = Math.min(node.width, node.height)
  const name = library && icon ? iconName(library, icon) : null
  if (!library || !name || size <= 0) return
  const options = iconOptions(library, resolveOptionalNumber(pen.weight, ctx))
  if (!build.icons?.draw(graph, node.id, name, size, color, options)) return
  const dx = (node.width - size) / 2
  const dy = (node.height - size) / 2
  for (const glyph of graph.getChildren(node.id)) {
    graph.updateNode(glyph.id, { x: glyph.x + dx, y: glyph.y + dy })
  }
}

/**
 * Whether a layer built under `parentId` is part of a component. An instance cannot redraw the
 * paths of a layer it copies, so an icon there is an instance of an icon component, which an
 * instance of the enclosing component can swap, as Figma's icon sets work.
 */
export function insideComponent(graph: SceneGraph, parentId: string): boolean {
  for (let node = graph.getNode(parentId); node;) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') return true
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return false
}

/**
 * The component that draws an icon at a size, made on first use on an "Icons" page. Each size is
 * its own component, so the glyph is drawn at that size, as pen.dev draws it, rather than scaled.
 */
function iconComponent(build: Build, pen: PenNode, width: number, height: number): string {
  const { graph, ctx } = build
  const library = resolveString(pen.library, ctx) ?? ''
  const icon = resolveString(pen.icon, ctx) ?? ''
  const options = iconOptions(library, resolveOptionalNumber(pen.weight, ctx))
  const key = `${library}/${icon}/${width}x${height}${options ? `/${JSON.stringify(options)}` : ''}`
  const existing = build.iconComponents.get(key)
  if (existing) return existing
  build.iconPageId ??= graph.addPage('Icons').id
  const placed = [...build.iconComponents.values()].map((id) => graph.getNode(id))
  const x = placed.reduce((end, node) => Math.max(end, (node?.x ?? 0) + (node?.width ?? 0)), 0)
  const component = graph.createNode('COMPONENT', build.iconPageId, {
    name: key,
    x: placed.length > 0 ? x + ICON_COMPONENT_GAP : 0,
    width,
    height,
    fills: [{ type: 'SOLID', color: { ...BLACK }, opacity: 1, visible: true }]
  })
  drawIcon(component, pen, build)
  build.iconComponents.set(key, component.id)
  return component.id
}

/** Paints an icon's glyph `color` where it takes the icon's colour, as overrides of the instance. */
function recolorGlyph(graph: SceneGraph, instanceId: string, color: Color): void {
  for (const glyph of graph.getChildren(instanceId)) {
    const tint = readIconTint(glyph)
    const fills = tint.includes('fill')
      ? glyph.fills.map((fill) => ({ ...fill, color }))
      : glyph.fills
    const strokes = tint.includes('stroke')
      ? glyph.strokes.map((stroke) => ({ ...stroke, color }))
      : glyph.strokes
    const changed = [
      ...(isEqual(fills, glyph.fills) ? [] : ['fills']),
      ...(isEqual(strokes, glyph.strokes) ? [] : ['strokes'])
    ]
    if (changed.length === 0) continue
    graph.updateNode(glyph.id, { fills, strokes })
    recordInstanceOverride(graph, glyph.id, changed)
  }
}

/**
 * Keeps what the icon instance sets on itself, such as its opacity or effects, as overrides of it:
 * the icon component is shared by every use of the glyph at that size, so linking to it would
 * otherwise give the instance the component's values.
 */
function keepOwnFields(
  graph: SceneGraph,
  instanceId: string,
  own: Partial<SceneNode>,
  componentId: string
): void {
  const component = graph.getNode(componentId)
  const differing = INSTANCE_SYNC_PROPS.filter((field) => !isEqual(own[field], component?.[field]))
  if (differing.length === 0) return
  graph.updateNode(instanceId, pick(own, differing))
  recordInstanceOverride(graph, instanceId, differing)
}

/**
 * Whether a copy of an icon still shows the glyph its source showed when it was copied: drawing
 * the source again at its laid-out size gives it a new glyph, which the copy does not follow.
 */
function showsReplacedGlyph(graph: SceneGraph, copy: SceneNode, sourceId: string): boolean {
  const sourceChildIds = graph.getNode(sourceId)?.childIds ?? []
  return graph
    .getChildren(copy.id)
    .some((glyph) => !glyph.componentId || !sourceChildIds.includes(glyph.componentId))
}

/**
 * Makes the icon instance `node` show its icon: the icon component for its glyph and size,
 * swapped in when an override changed either, with the glyph in the icon's fill colour.
 */
export function useIconComponent(node: SceneNode, pen: PenNode, build: Build): void {
  const { graph } = build
  const color = node.fills.find((fill) => fill.type === 'SOLID')?.color ?? { ...BLACK }
  node.fills = []
  const own = structuredClone(pick(node, INSTANCE_SYNC_PROPS))
  const componentId = iconComponent(build, pen, node.width, node.height)
  if (!node.componentId) {
    graph.updateNode(node.id, { componentId })
    populateInstanceChildren(graph, node.id, componentId)
  } else if (instanceMainComponent(graph, node)?.id !== componentId) {
    swapInstanceComponent(graph, node.id, componentId, { keepName: true })
    // The layer keeps its own name rather than the icon's, which a saved file keeps as an override.
    recordInstanceOverride(graph, node.id, ['name'])
  } else if (showsReplacedGlyph(graph, node, node.componentId)) {
    for (const childId of node.childIds) graph.deleteNode(childId)
    populateInstanceChildren(graph, node.id, node.componentId)
  }
  keepOwnFields(graph, node.id, own, componentId)
  recolorGlyph(graph, node.id, color)
}

/**
 * Removes the icon components no icon shows any more: those for the sizes reading guessed before
 * laying out gave the icons theirs.
 */
export function removeUnusedIconComponents(build: Build): void {
  for (const [key, id] of build.iconComponents) {
    if (getInstances(build.graph, id).length > 0) continue
    build.graph.deleteNode(id)
    build.iconComponents.delete(key)
  }
}
