import {
  getNodeLocalMatrix,
  getParentToContainerMatrix,
  getWorldMatrix,
  FITTED_CONTAINER_TYPES,
  TRANSFORM_FIELDS as NODE_TRANSFORM_FIELDS,
  findInstanceAncestor,
  rescaleNodeTree,
  slotPropertyId,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  fitGroupsAround,
  graph,
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import { computeAbsoluteRenderBounds } from '#core/figma-api/render-bounds'
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

/** Where Figma's plugin API places a node: in its container's space, looking through groups. */
function containerPosition(node: SceneNode, scene: SceneGraph): Vector {
  const [x, y] = Matrix.mapPoints(getParentToContainerMatrix(node, scene), [node.x, node.y])
  return { x, y }
}

function setPosition(
  target: ProxyThis,
  internals: NodeProxyInternals,
  axis: 'x' | 'y',
  value: number
) {
  assertEditable(target, internals)
  const scene = graph(target, internals)
  const node = raw(target, internals)
  if (!inGroup(node, scene)) {
    scene.updateNode(node.id, { [axis]: value })
    return
  }
  const desired = { ...containerPosition(node, scene), [axis]: value }
  const toParent = Matrix.invert(getParentToContainerMatrix(node, scene)) ?? Matrix.identity()
  const [x, y] = Matrix.mapPoints(toParent, [desired.x, desired.y])
  scene.updateNode(node.id, { x, y })
  fitGroupsAround(scene, node.parentId)
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
    x: {
      get(this: ProxyThis): number {
        return containerPosition(raw(this, internals), graph(this, internals)).x
      },
      set(this: ProxyThis, value: number) {
        setPosition(this, internals, 'x', value)
      }
    },
    y: {
      get(this: ProxyThis): number {
        return containerPosition(raw(this, internals), graph(this, internals)).y
      },
      set(this: ProxyThis, value: number) {
        setPosition(this, internals, 'y', value)
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
        const scene = graph(this, internals)
        scene.updateNode(nodeId(this, internals), { rotation: value })
        fitGroupsAround(scene, raw(this, internals).parentId)
      }
    },
    relativeTransform: {
      get(this: ProxyThis): FigmaTransform {
        const node = raw(this, internals)
        const scene = graph(this, internals)
        // Children of groups report a transform into the container, as Figma does.
        if (inGroup(node, scene)) {
          return figmaTransform(
            Matrix.multiply(getParentToContainerMatrix(node, scene), getNodeLocalMatrix(node))
          )
        }
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
      updateNode(this, internals, { width, height })
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
