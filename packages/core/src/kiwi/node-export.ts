import { mergePluginData, serializePluginRelaunchData } from './plugin-data'

import type { SceneGraph, SceneNode } from '../scene-graph'
import type { Color, GUID, Matrix } from '../types'
import type { NodeChange, Paint } from './codec'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

interface SceneNodeToKiwiContext {
  graph: SceneGraph
  blobs: Uint8Array[]
  nodeIdToGuid?: Map<string, GUID>
  fontDigestMap?: Map<string, Uint8Array>
  varIdToGuid?: Map<string, GUID>
  fractionalPosition: (index: number) => string
  mapToFigmaType: (type: SceneNode['type']) => string
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
  safeColor: (color: { r: number; g: number; b: number; a?: number }) => Color
  computeExportTransform: (node: SceneNode, graph: SceneGraph) => Matrix
  serializeCornerRadii: (node: SceneNode, nc: KiwiNodeChange) => void
  serializeTextProps: (
    node: SceneNode,
    nc: KiwiNodeChange,
    graph: SceneGraph,
    fontDigestMap?: Map<string, Uint8Array>
  ) => void
  serializeLayoutProps: (node: SceneNode, nc: KiwiNodeChange) => void
  serializeGeometry: (node: SceneNode, nc: KiwiNodeChange, blobs: Uint8Array[]) => void
  serializeVariableBindings: (
    node: SceneNode,
    nc: KiwiNodeChange,
    graph: SceneGraph,
    varIdToGuid?: Map<string, GUID>
  ) => void
  sceneNodeToKiwi: (
    node: SceneNode,
    parentGuid: GUID,
    childIndex: number,
    localIdCounter: { value: number },
    context: SceneNodeToKiwiContext
  ) => KiwiNodeChange[]
}

const DEFAULT_STROKE_WEIGHT = 1

function createStrokePaints(context: SceneNodeToKiwiContext, node: SceneNode): Paint[] {
  return node.strokes.map((stroke) => ({
    type: 'SOLID',
    color: context.safeColor(stroke.color),
    opacity: stroke.opacity,
    visible: stroke.visible,
    blendMode: 'NORMAL'
  }))
}

function applyNodeVisualProps(context: SceneNodeToKiwiContext, node: SceneNode, nc: KiwiNodeChange): void {
  if (node.independentStrokeWeights) {
    nc.borderStrokeWeightsIndependent = true
    nc.borderTopWeight = node.borderTopWeight
    nc.borderRightWeight = node.borderRightWeight
    nc.borderBottomWeight = node.borderBottomWeight
    nc.borderLeftWeight = node.borderLeftWeight
  }

  if (node.fills.length > 0) nc.fillPaints = node.fills.map(context.fillToKiwiPaint)

  context.serializeCornerRadii(node, nc)

  if (node.effects.length > 0) {
    nc.effects = node.effects.map((effect) => ({
      type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
      color: context.safeColor(effect.color),
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread,
      visible: effect.visible
    }))
  }

  if (node.type === 'TEXT') {
    context.serializeTextProps(node, nc, context.graph, context.fontDigestMap)
  }

  nc.frameMaskDisabled = !node.clipsContent
  if (node.horizontalConstraint !== 'MIN') nc.horizontalConstraint = node.horizontalConstraint
  if (node.verticalConstraint !== 'MIN') nc.verticalConstraint = node.verticalConstraint
  if (node.strokeCap !== 'NONE') nc.strokeCap = node.strokeCap
  if (node.strokeJoin !== 'MITER') nc.strokeJoin = node.strokeJoin
  if (node.strokeMiterLimit !== 28.96) nc.miterLimit = node.strokeMiterLimit
  if (node.dashPattern.length > 0) nc.dashPattern = node.dashPattern
  if (node.arcData) {
    nc.arcData = {
      startingAngle: node.arcData.startingAngle,
      endingAngle: node.arcData.endingAngle,
      innerRadius: node.arcData.innerRadius
    }
  }
  if (!node.autoRename) nc.autoRename = false
}

export function sceneNodeToKiwiWithContext(
  node: SceneNode,
  parentGuid: GUID,
  childIndex: number,
  localIdCounter: { value: number },
  context: SceneNodeToKiwiContext
): KiwiNodeChange[] {
  const localID = localIdCounter.value++
  const guid = { sessionID: 1, localID }
  context.nodeIdToGuid?.set(node.id, guid)

  const strokePaints = createStrokePaints(context, node)

  const nc: KiwiNodeChange = {
    guid,
    parentIndex: { guid: parentGuid, position: context.fractionalPosition(childIndex) },
    type: context.mapToFigmaType(node.type),
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    phase: 'CREATED',
    size: { x: node.width, y: node.height },
    transform: context.computeExportTransform(node, context.graph),
    strokeWeight: node.strokes[0]?.weight ?? DEFAULT_STROKE_WEIGHT,
    strokeAlign: node.strokes[0]?.align ?? 'INSIDE'
  }

  applyNodeVisualProps(context, node, nc)
  if (strokePaints.length > 0) nc.strokePaints = strokePaints

  context.serializeLayoutProps(node, nc)
  context.serializeGeometry(node, nc, context.blobs)
  context.serializeVariableBindings(node, nc, context.graph, context.varIdToGuid)

  const pluginData = mergePluginData(node.pluginData, node.sharedPluginData)
  if (pluginData.length > 0) nc.pluginData = pluginData
  if (node.pluginRelaunchData.length > 0) {
    nc.pluginRelaunchData = serializePluginRelaunchData(node.pluginRelaunchData)
  }

  const result: KiwiNodeChange[] = [nc]
  const children = context.graph.getChildren(node.id)
  for (let i = 0; i < children.length; i++) {
    result.push(...context.sceneNodeToKiwi(children[i], guid, i, localIdCounter, context))
  }
  return result
}
