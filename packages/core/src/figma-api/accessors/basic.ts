import {
  getAxisAlignedWorldBounds,
  getWorldMatrix,
  FITTED_CONTAINER_TYPES,
  TRANSFORM_FIELDS as NODE_TRANSFORM_FIELDS,
  findInstanceAncestor,
  recordInstanceOverride,
  rescaleNodeTree,
  slotPropertyId,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  fitGroupsAround,
  graph,
  hostFitOptions,
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import { computeAbsoluteRenderBounds } from '#core/figma-api/render-bounds'
import {
  containerTransform,
  figmaRotation,
  setContainerTransform,
  withFigmaRotation,
  withOrigin
} from '#core/figma-api/transform'
import type { FigmaTransform } from '#core/figma-api/types'

const TRANSFORM_FIELDS: ReadonlySet<string> = new Set(NODE_TRANSFORM_FIELDS)

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

function inGroup(node: SceneNode, scene: SceneGraph): boolean {
  const parent = node.parentId ? scene.getNode(node.parentId) : undefined
  return parent !== undefined && FITTED_CONTAINER_TYPES.has(parent.type)
}

/**
 * Moves, turns, or resizes a node as Figma's plugin API does: its transform into its container
 * keeps whatever `change` leaves of it, so the top-left corner stays put unless moved, and the
 * groups around it refit.
 */
function setTransform(
  target: ProxyThis,
  internals: NodeProxyInternals,
  change: (matrix: Mat3) => Mat3
) {
  assertEditable(target, internals)
  const scene = graph(target, internals)
  const node = raw(target, internals)
  setContainerTransform(scene, node, change(containerTransform(node, scene)))
  fitGroupsAround(scene, node.parentId, hostFitOptions(target, internals))
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
      get(this: ProxyThis): SceneNode['type'] | 'SLOT' {
        const node = raw(this, internals)
        return slotPropertyId(node) ? 'SLOT' : node.type
      }
    },
    name: {
      get(this: ProxyThis): string {
        return raw(this, internals).name
      },
      set(this: ProxyThis, value: string) {
        updateNode(this, internals, { name: value })
      }
    },
    removed: {
      get(this: ProxyThis): boolean {
        return !graph(this, internals).getNode(nodeId(this, internals))
      }
    },
    // Figma places a node by its top-left corner in its container, wherever rotation takes it.
    x: {
      get(this: ProxyThis): number {
        return containerTransform(raw(this, internals), graph(this, internals))[2]
      },
      set(this: ProxyThis, value: number) {
        setTransform(this, internals, (matrix) => withOrigin(matrix, value, matrix[5]))
      }
    },
    y: {
      get(this: ProxyThis): number {
        return containerTransform(raw(this, internals), graph(this, internals))[5]
      },
      set(this: ProxyThis, value: number) {
        setTransform(this, internals, (matrix) => withOrigin(matrix, matrix[2], value))
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
        return figmaRotation(containerTransform(node, graph(this, internals)))
      },
      // Figma turns a node counterclockwise about its top-left corner.
      set(this: ProxyThis, value: number) {
        setTransform(this, internals, (matrix) => withFigmaRotation(matrix, value))
      }
    },
    relativeTransform: {
      get(this: ProxyThis): FigmaTransform {
        const node = raw(this, internals)
        const scene = graph(this, internals)
        // Children of groups report a transform into the container, as Figma does.
        if (inGroup(node, scene)) return figmaTransform(containerTransform(node, scene))
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
        return figmaTransform(containerTransform(node, scene))
      },
      set(this: ProxyThis, value: FigmaTransform) {
        const [[a, b, x], [c, d, y]] = value
        setTransform(this, internals, () => [a, b, x, c, d, y, 0, 0, 1])
      }
    },
    absoluteTransform: {
      get(this: ProxyThis): FigmaTransform {
        return figmaTransform(getWorldMatrix(raw(this, internals), graph(this, internals)))
      }
    },
    absoluteBoundingBox: {
      get(this: ProxyThis): Rect {
        return getAxisAlignedWorldBounds(raw(this, internals), graph(this, internals))
      }
    },
    absoluteRenderBounds: {
      get(this: ProxyThis): Rect | null {
        return computeAbsoluteRenderBounds(graph(this, internals), raw(this, internals))
      }
    }
  })

  Object.assign(prototype, {
    // A resized node keeps its top-left corner, as Figma's does, though it turns about its center.
    // The groups around it refit once, after the corner is back in place.
    resize(this: ProxyThis, width: number, height: number): void {
      assertEditable(this, internals)
      const scene = graph(this, internals)
      const node = raw(this, internals)
      const before = containerTransform(node, scene)
      scene.updateNode(node.id, { width, height })
      recordInstanceOverride(scene, node.id, ['width', 'height'])
      setTransform(this, internals, () => before)
    },
    resizeWithoutConstraints(this: ProxyThis, width: number, height: number): void {
      ;(this as { resize(width: number, height: number): void }).resize(width, height)
    },
    rescale(this: ProxyThis, scale: number): void {
      assertEditable(this, internals)
      const scene = graph(this, internals)
      const node = raw(this, internals)
      if (node.parentId && findInstanceAncestor(scene, node.parentId))
        throw new Error('This property cannot be overridden in an instance: size')
      rescaleNodeTree(scene, node.id, scale)
    }
  })
}

export type { NodeProxyHost }
