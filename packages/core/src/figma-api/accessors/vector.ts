import { normalizeVectorNetwork, validateVectorNetwork } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from '#core/io/formats/svg/paths'

export interface FigmaVectorPath {
  readonly windingRule: 'NONZERO' | 'EVENODD'
  readonly data: string
}

/**
 * Merge `d` strings into one network so a multi-path assignment lands as a
 * single node's geometry, matching how the plugin API treats vectorPaths.
 */
function networkFromVectorPaths(paths: readonly FigmaVectorPath[]): VectorNetwork {
  const merged: VectorNetwork = { vertices: [], segments: [], regions: [] }
  for (const path of paths) {
    if (!path.data.trim()) continue
    const parsed = parseSVGPath(path.data, path.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO')
    const vertexOffset = merged.vertices.length
    const segmentOffset = merged.segments.length
    merged.vertices.push(...parsed.vertices)
    for (const segment of parsed.segments) {
      merged.segments.push({
        ...segment,
        start: segment.start + vertexOffset,
        end: segment.end + vertexOffset
      })
    }
    for (const region of parsed.regions) {
      merged.regions.push({
        windingRule: region.windingRule,
        loops: region.loops.map((loop) => loop.map((index) => index + segmentOffset))
      })
    }
  }
  return merged
}

export function installVectorNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    vectorPaths: {
      get(this: ProxyThis): readonly FigmaVectorPath[] {
        const node = raw(this, internals)
        const paths =
          node.fillGeometry.length > 0
            ? node.fillGeometry.map((geometry) => ({
                windingRule: geometry.windingRule,
                data: geometryBlobToSVGPath(geometry.commandsBlob)
              }))
            : (node.vectorNetwork ? vectorNetworkToSVGPaths(node.vectorNetwork) : []).map(
                (data) => ({
                  windingRule: 'NONZERO' as const,
                  data
                })
              )
        return Object.freeze(paths.map((path) => Object.freeze(path)))
      },
      set(this: ProxyThis, value: readonly FigmaVectorPath[]) {
        // Previously getter-only, which made assignment a silent no-op: callers
        // got a named node with no geometry and no error to react to.
        if (!Array.isArray(value)) throw new TypeError('vectorPaths must be an array')
        updateNode(this, internals, {
          vectorNetwork: normalizeVectorNetwork(networkFromVectorPaths(value)),
          // Blobs are derived from the old network; drop them so paint follows.
          fillGeometry: []
        })
      }
    },
    vectorNetwork: {
      get(this: ProxyThis): VectorNetwork | null {
        return raw(this, internals).vectorNetwork
      },
      set(this: ProxyThis, value: VectorNetwork | null) {
        if (value == null) {
          updateNode(this, internals, { vectorNetwork: null })
          return
        }
        const errors = validateVectorNetwork(value)
        if (errors.length > 0) {
          throw new TypeError(`Invalid VectorNetwork: ${errors.join('; ')}`)
        }
        updateNode(this, internals, {
          vectorNetwork: normalizeVectorNetwork(value),
          fillGeometry: []
        })
      }
    }
  })
}
