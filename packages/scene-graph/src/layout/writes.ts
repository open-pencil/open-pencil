import { SIZE_FIELDS, TRANSFORM_FIELDS } from '../fields/geometry'
import { createResizeSnapshot, scaledGeometryChanges } from '../resize'
import type { SceneNode } from '../types'

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
  // bring the shape back.
  return scaledGeometryChanges(
    createResizeSnapshot(node),
    width,
    height,
    node.width > 0 ? node.width : width,
    node.height > 0 ? node.height : height
  )
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
        // Saved outlines scale with the box. A vector network this layout replaced, such as a
        // connector's route, is already in the box. One it left still describes the old box, and
        // the renderer rebuilds an inside, centered, or outside stroke from it.
        const geometry = keptSizeGeometry(node, before)
        const outlines: Partial<SceneNode> = {}
        if ('fillGeometry' in geometry) outlines.fillGeometry = geometry.fillGeometry
        if ('strokeGeometry' in geometry) outlines.strokeGeometry = geometry.strokeGeometry
        const replacedNetwork =
          changed.has('vectorNetwork') && !Object.is(node.vectorNetwork, before.vectorNetwork)
        if (!replacedNetwork && 'vectorNetwork' in geometry) {
          outlines.vectorNetwork = geometry.vectorNetwork
        }
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
