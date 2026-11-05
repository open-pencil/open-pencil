import type { SceneNode } from '@open-pencil/scene-graph'
import type { VectorPath } from '@open-pencil/scene-graph/vector-network'

import type { SkiaRenderer } from '#core/canvas'
import { fillGeometryPaths, strokeGeometryPath } from '#core/canvas/geometry'
import { outlineStrokeLayer } from '#core/canvas/outline-stroke'
import { graph, raw, type NodeProxyInternals, type ProxyThis } from '#core/figma-api/accessor-utils'
import { flushPendingLayout } from '#core/figma-api/pending-layout'
import type { FigmaNodeProxy, NodeProxyHost } from '#core/figma-api/proxy'
import { findPageId } from '#core/io/subgraph'

import { figmaVectorPaths } from './format'

/** The layers Figma's `GeometryMixin` gives `fillGeometry`, `strokeGeometry`, and `outlineStroke`. */
const GEOMETRY_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'RECTANGLE',
  'ELLIPSE',
  'LINE',
  'POLYGON',
  'STAR',
  'VECTOR',
  'TEXT',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'BOOLEAN_OPERATION'
])

function host(target: ProxyThis, internals: NodeProxyInternals): NodeProxyHost {
  return target[internals.api] as NodeProxyHost
}

/** The host's renderer, which measures geometry, or the error a host without one gives. */
function renderer(target: ProxyThis, internals: NodeProxyInternals, member: string): SkiaRenderer {
  const measuring = host(target, internals).renderer
  if (!measuring) {
    throw new Error(`in ${member}: This host has no renderer to measure geometry with`)
  }
  return measuring
}

function frozenPaths(paths: VectorPath[]): readonly VectorPath[] {
  return Object.freeze(paths.map((path) => Object.freeze(path)))
}

/**
 * `fillGeometry`, `strokeGeometry`, and `outlineStroke` on the layers that have them in Figma,
 * measured by the host's renderer.
 */
export function installGeometryAccessors(
  target: object,
  internals: NodeProxyInternals,
  type: SceneNode['type']
): void {
  if (!GEOMETRY_TYPES.has(type)) return
  Object.defineProperty(target, 'fillGeometry', {
    get(this: ProxyThis): readonly VectorPath[] {
      const r = renderer(this, internals, 'get_fillGeometry')
      // A script's edits that nothing read yet are laid out first, as Figma lays them out.
      flushPendingLayout(graph(this, internals))
      const paths = fillGeometryPaths(r, graph(this, internals), raw(this, internals))
      try {
        return frozenPaths(figmaVectorPaths(r.ck, paths))
      } finally {
        for (const path of paths) path.delete()
      }
    }
  })
  Object.defineProperty(target, 'strokeGeometry', {
    get(this: ProxyThis): readonly VectorPath[] {
      const r = renderer(this, internals, 'get_strokeGeometry')
      flushPendingLayout(graph(this, internals))
      const path = strokeGeometryPath(r, graph(this, internals), raw(this, internals))
      if (!path) return frozenPaths([])
      try {
        // Figma reports a stroke as one path that fills its band, whatever the shape's own rule.
        return frozenPaths(
          figmaVectorPaths(r.ck, [path]).map((p) => ({ ...p, windingRule: 'NONZERO' }))
        )
      } finally {
        path.delete()
      }
    }
  })
  Object.defineProperty(target, 'outlineStroke', {
    value(this: ProxyThis): FigmaNodeProxy | null {
      const r = renderer(this, internals, 'outlineStroke')
      const scene = graph(this, internals)
      flushPendingLayout(scene)
      const node = raw(this, internals)
      const outlined = outlineStrokeLayer(r, node, scene)
      const pageId = findPageId(scene, node.id)
      if (!outlined || !pageId) return null
      // Figma adds the outline to the end of the page at the layer's own position in its parent,
      // and keeps the layer.
      const { stroke } = outlined
      const made = scene.createNode(stroke.type, pageId, stroke.props)
      for (const child of stroke.children) scene.createNode('VECTOR', made.id, child)
      return host(this, internals).wrapNode(made.id)
    }
  })
}
