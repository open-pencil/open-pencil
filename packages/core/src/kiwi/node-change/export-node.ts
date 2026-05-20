import type { NodeChange, Paint } from '#core/kiwi/binary/codec'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { Color, GUID, Matrix } from '#core/types'

import { stringToGuid } from './guid'
import {
  mergePluginData,
  NODE_TYPE_PLUGIN_KEY,
  serializePluginRelaunchData,
  upsertPluginData
} from './plugin-data'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

interface SceneNodeToKiwiContext {
  graph: SceneGraph
  blobs: Uint8Array[]
  nodeIdToGuid?: Map<string, GUID>
  fontDigestMap?: Map<string, Uint8Array>
  glyphBlobMap?: Map<string, number>
  varIdToGuid?: Map<string, GUID>
  fractionalPosition: (index: number) => string
  mapToFigmaType: (type: SceneNode['type']) => string
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
  safeColor: (color: Color) => Color
  computeExportTransform: (node: SceneNode, graph: SceneGraph) => Matrix
  serializeCornerRadii: (node: SceneNode, nc: KiwiNodeChange) => void
  serializeTextProps: (
    node: SceneNode,
    nc: KiwiNodeChange,
    graph: SceneGraph,
    fontDigestMap: Map<string, Uint8Array> | undefined,
    blobs: Uint8Array[],
    glyphBlobMap: Map<string, number> | undefined
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

function applyColorVariableBinding(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  paint: Paint,
  field: string
): Paint {
  const variableId = node.boundVariables[field]
  if (!variableId) return paint
  return {
    ...paint,
    colorVariableBinding: {
      variableID: context.varIdToGuid?.get(variableId) ?? stringToGuid(variableId)
    }
  }
}

function createStrokePaints(context: SceneNodeToKiwiContext, node: SceneNode): Paint[] {
  return node.strokes.map((stroke, index) =>
    applyColorVariableBinding(
      context,
      node,
      {
        type: 'SOLID',
        color: context.safeColor(stroke.color),
        opacity: stroke.opacity,
        visible: stroke.visible,
        blendMode: 'NORMAL'
      },
      `strokes/${index}/color`
    )
  )
}

function componentPropertyValue(value: string) {
  return { textValue: { characters: value } }
}

function componentPropertyTypeForKiwi(type: string) {
  if (type === 'BOOLEAN') return 'BOOL'
  if (type === 'VARIANT') return 'TEXT'
  return type
}

function parseGuidOrNull(value: string) {
  return /^\d+:\d+$/.test(value) ? stringToGuid(value) : null
}

function resolveInstanceComponentId(context: SceneNodeToKiwiContext, componentId: string): string {
  const seen = new Set<string>()
  let currentId = componentId
  while (!seen.has(currentId)) {
    seen.add(currentId)
    const node = context.graph.getNode(currentId)
    if (node?.type !== 'INSTANCE' || !node.componentId) return currentId
    currentId = node.componentId
  }
  return componentId
}

function getOrCreateNodeGuid(
  context: SceneNodeToKiwiContext,
  nodeId: string,
  localIdCounter: { value: number }
): GUID | undefined {
  if (!context.graph.getNode(nodeId)) return undefined
  const existing = context.nodeIdToGuid?.get(nodeId)
  if (existing) return existing
  const guid = { sessionID: 1, localID: localIdCounter.value++ }
  context.nodeIdToGuid?.set(nodeId, guid)
  return guid
}

function applyComponentMetadata(node: SceneNode, nc: KiwiNodeChange): void {
  if (node.componentKey) nc.componentKey = node.componentKey
  if (node.sourceLibraryKey) nc.sourceLibraryKey = node.sourceLibraryKey
  const publishId = node.publishId ? parseGuidOrNull(node.publishId) : null
  const overrideKey = node.overrideKey ? parseGuidOrNull(node.overrideKey) : null
  if (publishId) nc.publishID = publishId
  if (overrideKey) nc.overrideKey = overrideKey
  if (node.sharedSymbolVersion) nc.sharedSymbolVersion = node.sharedSymbolVersion
  if (node.publishedVersion) nc.publishedVersion = node.publishedVersion
  if (node.isPublishable) nc.isPublishable = true
  if (node.isSymbolPublishable) nc.isSymbolPublishable = true
  if (node.symbolDescription) nc.symbolDescription = node.symbolDescription
  if (node.symbolLinks.length > 0) nc.symbolLinks = structuredClone(node.symbolLinks)
  const componentPropDefs = node.componentPropertyDefinitions
    .map((def) => {
      const id = parseGuidOrNull(def.id)
      return id
        ? {
            id,
            name: def.name,
            type: componentPropertyTypeForKiwi(def.type),
            initialValue: componentPropertyValue(def.defaultValue)
          }
        : null
    })
    .filter((def): def is NonNullable<typeof def> => def !== null)
  if (componentPropDefs.length > 0) nc.componentPropDefs = componentPropDefs

  const variantPropSpecs = node.variantPropSpecs
    .map((spec) => {
      const propDefId = parseGuidOrNull(spec.propDefId)
      return propDefId ? { propDefId, value: spec.value } : null
    })
    .filter((spec): spec is NonNullable<typeof spec> => spec !== null)
  if (variantPropSpecs.length > 0) nc.variantPropSpecs = variantPropSpecs
}

function applyNodeVisualProps(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  if (node.independentStrokeWeights) {
    nc.borderStrokeWeightsIndependent = true
    nc.borderTopWeight = node.borderTopWeight
    nc.borderRightWeight = node.borderRightWeight
    nc.borderBottomWeight = node.borderBottomWeight
    nc.borderLeftWeight = node.borderLeftWeight
  }

  if (node.fills.length > 0) {
    nc.fillPaints = node.fills.map((fill, index) =>
      applyColorVariableBinding(
        context,
        node,
        context.fillToKiwiPaint(fill),
        `fills/${index}/color`
      )
    )
  }

  context.serializeCornerRadii(node, nc)

  if (node.effects.length > 0) {
    nc.effects = node.effects.map((effect) => ({
      type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
      color: context.safeColor(effect.color),
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread,
      visible: effect.visible,
      showShadowBehindNode: effect.showShadowBehindNode
    }))
  }

  if (node.type === 'TEXT') {
    context.serializeTextProps(
      node,
      nc,
      context.graph,
      context.fontDigestMap,
      context.blobs,
      context.glyphBlobMap
    )
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
  const guid = getOrCreateNodeGuid(context, node.id, localIdCounter) ?? {
    sessionID: 1,
    localID: localIdCounter.value++
  }

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
  applyComponentMetadata(node, nc)
  if (node.type === 'INSTANCE' && node.componentId) {
    const symbolID = getOrCreateNodeGuid(
      context,
      resolveInstanceComponentId(context, node.componentId),
      localIdCounter
    )
    if (symbolID) nc.symbolData = { symbolID }
  }
  if (node.type === 'COMPONENT_SET') upsertPluginData(node, NODE_TYPE_PLUGIN_KEY, node.type)
  if (strokePaints.length > 0) nc.strokePaints = strokePaints

  context.serializeLayoutProps(node, nc)
  context.serializeGeometry(node, nc, context.blobs)
  context.serializeVariableBindings(node, nc, context.graph, context.varIdToGuid)

  const pluginData = mergePluginData(node.pluginData)
  if (pluginData.length > 0) nc.pluginData = pluginData
  if (node.pluginRelaunchData.length > 0) {
    nc.pluginRelaunchData = serializePluginRelaunchData(node.pluginRelaunchData)
  }

  const result: KiwiNodeChange[] = [nc]
  const children = context.graph.getChildren(node.id).filter((child) => !child.internalOnly)
  for (let i = 0; i < children.length; i++) {
    result.push(...context.sceneNodeToKiwi(children[i], guid, i, localIdCounter, context))
  }
  return result
}
