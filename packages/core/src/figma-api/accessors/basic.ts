import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { TRANSFORM_FIELDS as NODE_TRANSFORM_FIELDS } from '@open-pencil/scene-graph/fields'
import { findInstanceAncestor, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { recapturedAspectRatio } from '@open-pencil/scene-graph/layout'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import { FITTED_CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import {
  computeConstrainedResizeChanges,
  createResizeSnapshot,
  scaledGeometryChanges,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  prepareFollowedFieldEdit,
  fitGroupsAround,
  graph,
  hostFitOptions,
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { invalid, numberProblem } from '#core/figma-api/accessors/text/messages'
import { flushPendingLayout } from '#core/figma-api/pending-layout'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import { computeAbsoluteRenderBounds } from '#core/figma-api/render-bounds'
import {
  containerTransform,
  setContainerTransform,
  withFigmaRotation,
  withOrigin
} from '#core/figma-api/transform'
import type { FigmaTransform } from '#core/figma-api/types'
import { syncVariantName } from '#core/figma-api/variants'
import { figmaRotation } from '#core/geometry/figma'
import { computeAccurateBounds } from '#core/vector/curve-math'

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
        // A variant's name holds its values, which the set's value lists follow.
        syncVariantName(graph(this, internals), raw(this, internals))
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
        flushPendingLayout(graph(this, internals))
        return containerTransform(raw(this, internals), graph(this, internals))[2]
      },
      set(this: ProxyThis, value: number) {
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'x',
          'relative-transform'
        )
        setTransform(this, internals, (matrix) => withOrigin(matrix, value, matrix[5]))
      }
    },
    y: {
      get(this: ProxyThis): number {
        flushPendingLayout(graph(this, internals))
        return containerTransform(raw(this, internals), graph(this, internals))[5]
      },
      set(this: ProxyThis, value: number) {
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'y',
          'relative-transform'
        )
        setTransform(this, internals, (matrix) => withOrigin(matrix, matrix[2], value))
      }
    },
    width: {
      get(this: ProxyThis): number {
        flushPendingLayout(graph(this, internals))
        return raw(this, internals).width
      }
    },
    height: {
      get(this: ProxyThis): number {
        flushPendingLayout(graph(this, internals))
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
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'rotation',
          'relative-transform'
        )
        setTransform(this, internals, (matrix) => withFigmaRotation(matrix, value))
      }
    },
    relativeTransform: {
      get(this: ProxyThis): FigmaTransform {
        const scene = graph(this, internals)
        flushPendingLayout(scene)
        const node = raw(this, internals)
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
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'relativeTransform',
          'relative-transform'
        )
        const [[a, b, x], [c, d, y]] = value
        setTransform(this, internals, () => [a, b, x, c, d, y, 0, 0, 1])
      }
    },
    absoluteTransform: {
      get(this: ProxyThis): FigmaTransform {
        flushPendingLayout(graph(this, internals))
        return figmaTransform(getWorldMatrix(raw(this, internals), graph(this, internals)))
      }
    },
    absoluteBoundingBox: {
      get(this: ProxyThis): Rect {
        flushPendingLayout(graph(this, internals))
        return getAxisAlignedWorldBounds(raw(this, internals), graph(this, internals))
      }
    },
    absoluteRenderBounds: {
      get(this: ProxyThis): Rect | null {
        flushPendingLayout(graph(this, internals))
        return computeAbsoluteRenderBounds(graph(this, internals), raw(this, internals))
      }
    }
  })

  Object.assign(prototype, {
    // A resized node keeps its top-left corner, as Figma's does, though it turns about its center.
    // The groups around it refit once, after the corner is back in place.
    resize(this: ProxyThis, width: number, height: number): void {
      resizeNode(this, internals, width, height, true)
    },
    resizeWithoutConstraints(this: ProxyThis, width: number, height: number): void {
      resizeNode(this, internals, width, height, false)
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

/** Every layer below a node, which a resize may place by its constraints. */
function descendants(scene: SceneGraph, node: SceneNode): SceneNode[] {
  return scene.getChildren(node.id).flatMap((child) => [child, ...descendants(scene, child)])
}

/**
 * A vector's path scaled to its new size, as Figma's resize does. The stroke keeps its weight: with
 * a path to stroke, the saved stroke outline goes and the stroke draws from the scaled path, as
 * when the path is set; without one, the outline is all that draws the stroke, so it scales.
 */
function resizedVectorGeometry(node: SceneNode, width: number, height: number): Partial<SceneNode> {
  if (node.type !== 'VECTOR') return {}
  // A side at zero keeps the path along it, as in Figma, so the next resize scales the path from
  // its own extent and gets the shape back.
  const bounds = node.vectorNetwork ? computeAccurateBounds(node.vectorNetwork) : null
  const fromWidth = node.width > 0 ? node.width : (bounds?.width ?? 0)
  const fromHeight = node.height > 0 ? node.height : (bounds?.height ?? 0)
  return scaledGeometryChanges(
    createResizeSnapshot(node),
    fromWidth,
    fromHeight,
    width || fromWidth,
    height || fromHeight
  )
}

/** The least size Figma's `resize` gives a side; `resizeWithoutConstraints` allows zero. */
const MIN_RESIZE = 0.0001

/**
 * The size a resize gives a node, as Figma's does: it refuses a side that is not a number or is
 * negative, and a vector cannot become 0×0. `resize` keeps the sides above zero, except a line's
 * height of zero, which is the height a line has.
 */
function resizedSize(
  node: SceneNode,
  width: number,
  height: number,
  constrained: boolean
): { width: number; height: number } {
  const method = constrained ? 'resize' : 'resizeWithoutConstraints'
  for (const [property, value] of [
    ['width', width],
    ['height', height]
  ] as const) {
    const problem =
      numberProblem(value) ?? (value < 0 ? 'Too small: expected number to be >=0' : null)
    if (problem) throw invalid(method, problem, property)
  }
  if (node.type === 'VECTOR' && width === 0 && height === 0)
    throw new Error('Cannot set width and height of vector node to zero')
  if (!constrained) return { width, height }
  return {
    width: Math.max(width, MIN_RESIZE),
    height: node.type === 'LINE' && height === 0 ? 0 : Math.max(height, MIN_RESIZE)
  }
}

interface ChangedSides {
  width: boolean
  height: boolean
}

/** Auto layout given a new size on an axis stops hugging along it, as in Figma; the other keeps on. */
function resizedLayoutSizing(node: SceneNode, changed: ChangedSides): Partial<SceneNode> {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return {}
  const row = node.layoutMode === 'HORIZONTAL'
  const sizing: Partial<SceneNode> = {}
  if ((row ? changed.width : changed.height) && node.primaryAxisSizing !== 'FIXED')
    sizing.primaryAxisSizing = 'FIXED'
  if ((row ? changed.height : changed.width) && node.counterAxisSizing !== 'FIXED')
    sizing.counterAxisSizing = 'FIXED'
  return sizing
}

/**
 * How a text sizes itself after a resize, as in Figma: a new height fixes it, and a new width alone
 * leaves auto-width text sizing only its height.
 */
function resizedTextSizing(node: SceneNode, changed: ChangedSides): Partial<SceneNode> {
  if (node.type !== 'TEXT') return {}
  const mode = node.textAutoResize
  if (changed.height && (mode === 'HEIGHT' || mode === 'WIDTH_AND_HEIGHT'))
    return { textAutoResize: 'NONE' }
  if (changed.width && mode === 'WIDTH_AND_HEIGHT') return { textAutoResize: 'HEIGHT' }
  return {}
}

/**
 * Resizes a node keeping its top-left corner, as Figma's does, though it turns about its center.
 * `resize` places the layers inside by their constraints, as Figma's does, without making their
 * sizes overrides; `resizeWithoutConstraints` leaves them be, except in an instance. The groups around the node refit
 * once, after the corner is back in place.
 */
function resizeNode(
  target: ProxyThis,
  internals: NodeProxyInternals,
  requestedWidth: number,
  requestedHeight: number,
  constrained: boolean
): void {
  assertEditable(target, internals)
  const scene = graph(target, internals)
  const node = raw(target, internals)
  const { width, height } = resizedSize(node, requestedWidth, requestedHeight, constrained)
  // Figma has no size for a layer inside an instance: the resize does nothing, and records nothing.
  if (node.parentId && findInstanceAncestor(scene, node.parentId)) return
  const before = containerTransform(node, scene)
  const size = { width: node.width, height: node.height }
  // An instance's layers follow its constraints however it is resized, as in Figma.
  const placed =
    constrained || node.type === 'INSTANCE'
      ? new Map(descendants(scene, node).map((child) => [child.id, createResizeSnapshot(child)]))
      : new Map<string, ResizeSnapshot>()
  const geometry = resizedVectorGeometry(node, width, height)
  // A locked ratio does not hold here; it takes the new size, as in Figma.
  const recaptured = recapturedAspectRatio(node, width, height)
  const changed = { width: width !== size.width, height: height !== size.height }
  const sizing = { ...resizedLayoutSizing(node, changed), ...resizedTextSizing(node, changed) }
  scene.updateNode(node.id, { width, height, ...geometry, ...recaptured, ...sizing })
  if (placed.size > 0 && size.width > 0 && size.height > 0) {
    const changes = computeConstrainedResizeChanges(scene, node.id, size, { width, height }, placed)
    for (const [id, change] of changes) scene.updateNode(id, change)
  }
  // A size the layer already has records nothing, as in Figma; a new one records both sides.
  recordInstanceOverride(scene, node.id, [
    ...(changed.width || changed.height ? ['width', 'height'] : []),
    ...Object.keys(geometry),
    ...Object.keys(recaptured),
    ...Object.keys(sizing)
  ])
  setTransform(target, internals, () => before)
}

export type { NodeProxyHost }
