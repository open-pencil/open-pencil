import { getNodeLocalMatrix, getWorldMatrix, type SceneNode } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  graph,
  nodeId,
  raw,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import { computeAbsoluteRenderBounds } from '#core/figma-api/render-bounds'
import { rescaleNodeTree } from '#core/figma-api/rescale'
import type { FigmaTransform } from '#core/figma-api/types'

const TRANSFORM_FIELDS = new Set(['x', 'y', 'rotation', 'flipX', 'flipY'])

function assertEditable(target: ProxyThis, internals: NodeProxyInternals): void {
  assertNodeEditable(graph(target, internals), nodeId(target, internals))
}

function preservesRawTransform(node: SceneNode): boolean {
  return !node.source.editedFields.some((field) => TRANSFORM_FIELDS.has(field))
}

function cleanTransformValue(value: number): number {
  if (Math.abs(value) < 1e-12) return 0
  const nearestInteger = Math.round(value)
  return Math.abs(value - nearestInteger) < 1e-12 ? nearestInteger : value
}

function figmaTransform(matrix: number[]): FigmaTransform {
  return [
    [
      cleanTransformValue(matrix[0]),
      cleanTransformValue(matrix[1]),
      cleanTransformValue(matrix[2])
    ],
    [cleanTransformValue(matrix[3]), cleanTransformValue(matrix[4]), cleanTransformValue(matrix[5])]
  ]
}

export function installBasicNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    id: {
      get(this: ProxyThis): string {
        return nodeId(this, internals)
      }
    },
    type: {
      get(this: ProxyThis): SceneNode['type'] {
        return raw(this, internals).type
      }
    },
    name: {
      get(this: ProxyThis): string {
        return raw(this, internals).name
      },
      set(this: ProxyThis, value: string) {
        assertEditable(this, internals)
        graph(this, internals).updateNode(nodeId(this, internals), { name: value })
      }
    },
    removed: {
      get(this: ProxyThis): boolean {
        return !graph(this, internals).getNode(nodeId(this, internals))
      }
    },
    x: {
      get(this: ProxyThis): number {
        return raw(this, internals).x
      },
      set(this: ProxyThis, value: number) {
        assertEditable(this, internals)
        graph(this, internals).updateNode(nodeId(this, internals), { x: value })
      }
    },
    y: {
      get(this: ProxyThis): number {
        return raw(this, internals).y
      },
      set(this: ProxyThis, value: number) {
        assertEditable(this, internals)
        graph(this, internals).updateNode(nodeId(this, internals), { y: value })
      }
    },
    width: {
      get(this: ProxyThis): number {
        return raw(this, internals).width
      }
    },
    height: {
      get(this: ProxyThis): number {
        return raw(this, internals).height
      }
    },
    rotation: {
      get(this: ProxyThis): number {
        const node = raw(this, internals)
        const sourceTransform = node.source.fig.rawTransform
        if (sourceTransform && preservesRawTransform(node)) {
          return Math.atan2(-sourceTransform.m10, sourceTransform.m00) * (180 / Math.PI)
        }
        return node.rotation
      },
      set(this: ProxyThis, value: number) {
        assertEditable(this, internals)
        graph(this, internals).updateNode(nodeId(this, internals), { rotation: value })
      }
    },
    relativeTransform: {
      get(this: ProxyThis): FigmaTransform {
        const node = raw(this, internals)
        const sourceTransform = node.source.fig.rawTransform
        if (sourceTransform && preservesRawTransform(node)) {
          return figmaTransform([
            sourceTransform.m00,
            sourceTransform.m01,
            sourceTransform.m02,
            sourceTransform.m10,
            sourceTransform.m11,
            sourceTransform.m12
          ])
        }
        return figmaTransform(getNodeLocalMatrix(node))
      }
    },
    absoluteTransform: {
      get(this: ProxyThis): FigmaTransform {
        return figmaTransform(getWorldMatrix(raw(this, internals), graph(this, internals)))
      }
    },
    absoluteBoundingBox: {
      get(this: ProxyThis): Rect {
        return graph(this, internals).getAbsoluteBounds(nodeId(this, internals))
      }
    },
    absoluteRenderBounds: {
      get(this: ProxyThis): Rect | null {
        return computeAbsoluteRenderBounds(graph(this, internals), raw(this, internals))
      }
    }
  })

  Object.assign(prototype, {
    resize(this: ProxyThis, width: number, height: number): void {
      assertEditable(this, internals)
      graph(this, internals).updateNode(nodeId(this, internals), { width, height })
    },
    resizeWithoutConstraints(this: ProxyThis, width: number, height: number): void {
      ;(this as { resize(width: number, height: number): void }).resize(width, height)
    },
    rescale(this: ProxyThis, scale: number): void {
      assertEditable(this, internals)
      rescaleNodeTree(graph(this, internals), nodeId(this, internals), scale)
    }
  })
}

export type { NodeProxyHost }
