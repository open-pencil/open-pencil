import { SIZE_FIELDS, TRANSFORM_FIELDS } from '../fields/geometry'
import type { Rect } from '../primitives'
import { createResizeSnapshot, scaledGeometryChanges } from '../resize'
import type { SceneNode, VectorNetwork } from '../types'
import { geometryAxisLengths, vectorNetworkAxisLengths } from '../vector-bounds'

/**
 * The layout results a format keeps apart from what it saved once an edit moves or sizes.
 * A resized outline is one of them: the file's saved stroke would otherwise outlive the box.
 */
const EDITED_GEOMETRY_FIELDS: ReadonlySet<keyof SceneNode> = new Set([
  ...TRANSFORM_FIELDS,
  ...SIZE_FIELDS,
  'fillGeometry',
  'strokeGeometry'
])

/**
 * The network the saved outlines were built from. A network this layout replaced already sits in
 * the new box, so its bounds are not the size those outlines were drawn at.
 */
function outlinesNetwork(node: SceneNode, before: Partial<SceneNode>): VectorNetwork | null {
  if (Object.hasOwn(before, 'vectorNetwork')) return before.vectorNetwork ?? null
  return node.vectorNetwork
}

/** A length a collapsed side can scale from. Zero and non-finite lengths are not one. */
function positiveLength(size: number | undefined): number | undefined {
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : undefined
}

/** The first usable length, preferring the network, then the fill, then an outline-only stroke. */
function axisExtent(
  network: number | undefined,
  fill: number | undefined,
  stroke: number | undefined
): number | undefined {
  return positiveLength(network) ?? positiveLength(fill) ?? positiveLength(stroke)
}

/**
 * The size a zero side scales from, with each axis measured on its own. A network wins. Saved
 * fill covers a childless boolean, on the curve rather than its handles. An outline-only vector
 * has only its stroke to measure.
 */
function collapsedPathExtent(
  node: SceneNode,
  before: Partial<SceneNode>
): Pick<Rect, 'width' | 'height'> | null {
  const network = outlinesNetwork(node, before)
  const fromNetwork =
    network && network.vertices.length > 0 ? vectorNetworkAxisLengths(network) : null
  const fromFill = geometryAxisLengths(node.fillGeometry)
  const outlineOnly = node.type === 'VECTOR' && (network?.segments.length ?? 0) === 0
  const fromStroke = outlineOnly ? geometryAxisLengths(node.strokeGeometry) : null
  const width = axisExtent(fromNetwork?.width, fromFill?.width, fromStroke?.width)
  const height = axisExtent(fromNetwork?.height, fromFill?.height, fromStroke?.height)
  if (width === undefined && height === undefined) return null
  return { width: width ?? 0, height: height ?? 0 }
}

/** A length a collapsed side can scale from. A non-finite one is no usable length. */
function finiteLength(size: number | undefined): number {
  return typeof size === 'number' && Number.isFinite(size) ? size : 0
}

/**
 * The outline a kept size change must take with it. The node already has its new box; the saved
 * paths are still the ones from `before`.
 */
function keptSizeGeometry(node: SceneNode, before: Partial<SceneNode>): Partial<SceneNode> {
  const saved =
    node.fillGeometry.length > 0 ||
    node.strokeGeometry.length > 0 ||
    node.vectorNetwork !== null ||
    (node.derivedTextGlyphs?.length ?? 0) > 0
  if (!saved) return {}
  const width = typeof before.width === 'number' ? before.width : node.width
  const height = typeof before.height === 'number' ? before.height : node.height
  // A side at zero keeps the path along it, as a plugin resize does. Scaling into that side
  // multiplies every coordinate by zero, and moving the layer out and sizing it again cannot
  // bring the shape back. A side already at zero lost the box the path was drawn in, so that
  // side scales from the tight box of the path it kept. A side that still has a size keeps it.
  // A bound that is not finite, which a decoded network can hold, is not a size to scale from.
  const extent = width > 0 && height > 0 ? null : collapsedPathExtent(node, before)
  const fromWidth = width > 0 ? width : finiteLength(extent?.width)
  const fromHeight = height > 0 ? height : finiteLength(extent?.height)
  return withoutUnscalableStroke(
    node,
    fromWidth,
    fromHeight,
    scaledGeometryChanges(
      createResizeSnapshot(node),
      fromWidth,
      fromHeight,
      node.width > 0 ? node.width : fromWidth,
      node.height > 0 ? node.height : fromHeight
    )
  )
}

/**
 * A shape that draws its stroke again from its own outline can drop a saved one it cannot scale.
 * A vector that has only that saved outline cannot: deleting it removes the stroke.
 */
function canRedrawStroke(node: SceneNode): boolean {
  return node.type !== 'VECTOR'
}

function withoutUnscalableStroke(
  node: SceneNode,
  fromWidth: number,
  fromHeight: number,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  const expanding = (fromWidth <= 0 && node.width > 0) || (fromHeight <= 0 && node.height > 0)
  if (
    canRedrawStroke(node) &&
    expanding &&
    node.strokeGeometry.length > 0 &&
    !Object.hasOwn(changes, 'strokeGeometry')
  ) {
    return { ...changes, strokeGeometry: [] }
  }
  return changes
}

/** Geometry this pass already replaced sits in the new box, so it is not scaled from the old one. */
function replacedGeometry(
  node: SceneNode,
  before: Partial<SceneNode>,
  changed: ReadonlySet<keyof SceneNode>,
  geometry: Partial<SceneNode>
): Partial<SceneNode> {
  const outlines: Partial<SceneNode> = {}
  const replacedFill =
    changed.has('fillGeometry') && !Object.is(node.fillGeometry, before.fillGeometry)
  const replacedStroke =
    changed.has('strokeGeometry') && !Object.is(node.strokeGeometry, before.strokeGeometry)
  const replacedNetwork =
    changed.has('vectorNetwork') && !Object.is(node.vectorNetwork, before.vectorNetwork)
  if (!replacedFill && Object.hasOwn(geometry, 'fillGeometry')) {
    outlines.fillGeometry = geometry.fillGeometry
  }
  if (!replacedStroke && Object.hasOwn(geometry, 'strokeGeometry')) {
    outlines.strokeGeometry = geometry.strokeGeometry
  }
  if (!replacedNetwork && Object.hasOwn(geometry, 'vectorNetwork')) {
    outlines.vectorNetwork = geometry.vectorNetwork
  }
  return outlines
}

interface LayerWrites {
  before: Partial<SceneNode>
  changed: Set<keyof SceneNode>
  /** Geometry an edit's layout wrote, rather than layout of what the document already holds. */
  edited: Set<keyof SceneNode>
}

/**
 * What one layout run writes to each layer: the values before its first write, and the keys it
 * actually changed. Layout passes can size a layer and size it back, such as a frame laid out on
 * its own and then by its parent, so a key that changed and came back is left out of the update.
 */
export class LayoutWrites {
  private readonly layers = new Map<string, LayerWrites>()

  /** Call before `changes` are applied to `node`; `edit` when an edit's layout writes them. */
  record(node: SceneNode, changes: Partial<SceneNode>, edit: boolean): void {
    let layer = this.layers.get(node.id)
    if (!layer) {
      layer = { before: {}, changed: new Set(), edited: new Set() }
      this.layers.set(node.id, layer)
    }
    for (const key of Object.keys(changes) as (keyof SceneNode)[]) {
      if (!Object.hasOwn(layer.before, key)) Object.assign(layer.before, { [key]: node[key] })
      if (!Object.is(node[key], changes[key])) layer.changed.add(key)
      if (edit && EDITED_GEOMETRY_FIELDS.has(key)) layer.edited.add(key)
    }
  }

  /**
   * Each written layer's update: the values layout changed and kept, and values it wrote as they
   * already were, which a preview's commit writes to publish what it showed. With it come the
   * geometry fields of that update an edit's layout wrote, which count as edited.
   */
  *updates(
    getNode: (id: string) => SceneNode | undefined
  ): Generator<[SceneNode, Partial<SceneNode>, (keyof SceneNode)[]]> {
    for (const [id, { before, changed, edited }] of this.layers) {
      const node = getNode(id)
      if (!node) continue
      const changes: Partial<SceneNode> = {}
      for (const key of Object.keys(before) as (keyof SceneNode)[]) {
        if (changed.has(key) && Object.is(node[key], before[key])) continue
        Object.assign(changes, { [key]: node[key] })
      }
      // A size layout keeps, and only that, drops or scales a saved outline. An inside stroke
      // paints the outline and clips it to the live shape, so the old border would stay inside
      // the new box. A pass that sizes a layer and a later pass puts the size back leaves the
      // outline. Text reflows its own. Derived layout does not mark the size edited, and keeps
      // the outlines a file saved.
      const keptSize =
        node.type !== 'TEXT' &&
        (['width', 'height'] as const).some((key) => edited.has(key) && key in changes)
      if (keptSize) {
        // Saved outlines scale with the box. A network or outline this layout replaced, such as a
        // connector's route, is already in the box. One it left still describes the old box, and
        // the renderer rebuilds an inside, centered, or outside stroke from it.
        const outlines = replacedGeometry(node, before, changed, keptSizeGeometry(node, before))
        Object.assign(node, outlines)
        Object.assign(changes, outlines)
        for (const key of Object.keys(outlines) as (keyof SceneNode)[]) {
          if (EDITED_GEOMETRY_FIELDS.has(key) || key === 'vectorNetwork') edited.add(key)
        }
      }
      const keys = Object.keys(changes) as (keyof SceneNode)[]
      if (keys.length > 0) yield [node, changes, keys.filter((key) => edited.has(key))]
    }
  }
}
