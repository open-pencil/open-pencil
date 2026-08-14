import {
  alignGeometryWindingRules,
  resolveGeometryPaths,
  resolveVectorStyleOverrideFills
} from '@open-pencil/fig/node-change'
import type { SceneNode } from '@open-pencil/scene-graph'
import { scaleGeometryPaths } from '@open-pencil/scene-graph/copy'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import type { DerivedSymbolOverride } from '../types'

export function resolveDsdGeometry(
  d: DerivedSymbolOverride,
  target: SceneNode,
  blobs: Uint8Array[]
): Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry' | 'vectorNetwork'> {
  const result: Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry' | 'vectorNetwork'> = {}
  const fg = resolveGeometryPaths(d.fillGeometry, blobs, resolveVectorStyleOverrideFills(d))
  const sg = resolveGeometryPaths(d.strokeGeometry, blobs)

  if (fg.length > 0) result.fillGeometry = alignGeometryWindingRules(fg, target.vectorNetwork)
  else if (d.size && target.fillGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.fillGeometry = scaleGeometryPaths(
      target.fillGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  if (sg.length > 0) result.strokeGeometry = sg
  else if (d.size && target.strokeGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.strokeGeometry = scaleGeometryPaths(
      target.strokeGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  if (d.size && target.vectorNetwork?.vertices.length) {
    const network = cloneVectorNetwork(target.vectorNetwork)
    const originX = Math.min(...network.vertices.map(({ x }) => x))
    const originY = Math.min(...network.vertices.map(({ y }) => y))
    const xs = network.vertices.map(({ x }) => x)
    const ys = network.vertices.map(({ y }) => y)
    const networkWidth = Math.max(...xs) - Math.min(...xs)
    const networkHeight = Math.max(...ys) - Math.min(...ys)
    const scaleX = networkWidth === 0 ? 1 : d.size.x / networkWidth
    const scaleY = networkHeight === 0 ? 1 : d.size.y / networkHeight
    for (const vertex of network.vertices) {
      vertex.x = originX + (vertex.x - originX) * scaleX
      vertex.y = originY + (vertex.y - originY) * scaleY
    }
    for (const segment of network.segments) {
      segment.tangentStart.x *= scaleX
      segment.tangentStart.y *= scaleY
      segment.tangentEnd.x *= scaleX
      segment.tangentEnd.y *= scaleY
    }
    result.vectorNetwork = network
  }

  return result
}
