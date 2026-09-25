import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color, GUID, Matrix } from '@open-pencil/scene-graph/primitives'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

export interface KiwiSymbolOverridePayload {
  guidPath?: { guids?: GUID[] }
  textData?: { characters?: string }
  fillPaints?: Paint[]
  [key: string]: unknown
}

export interface SceneNodeToKiwiContext {
  styleReferences?: ReadonlyMap<
    string,
    { guid?: GUID; assetRef?: { key: string; version?: string } }
  >
  graph: SceneGraph
  blobs: Uint8Array[]
  blobIndexByHex?: Map<string, number>
  nodeIdToGuid?: Map<string, GUID>
  /** Reverse index of assigned GUID values ("sessionID:localID") for O(1)
   *  collision detection. Populated alongside every nodeIdToGuid.set() call. */
  assignedGuidValues?: Set<string>
  fontDigestMap?: Map<string, Uint8Array>
  glyphBlobMap?: Map<string, number>
  varIdToGuid?: Map<string, GUID>
  modeIdToGuid?: Map<string, GUID>
  /** Variable GUIDs used only where raw effect aliases cannot retain asset refs. */
  assetRefToVarGuid?: Map<string, GUID>
  /** GUIDs minted for component property IDs (e.g. "prop:abc123") that aren't
   *  already Figma-GUID-shaped, keyed by the original ID so refs/assignments/
   *  variantPropSpecs pointing at the same property reuse the same GUID. */
  propertyIdToGuid: Map<string, GUID>
  componentPropertyDefinitionsById: ReadonlyMap<string, ComponentPropertyDefinition>
  fractionalPosition: (index: number) => string
  mapToFigmaType: (type: SceneNode['type']) => string
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
  safeColor: (color: Color) => Color
  computeExportTransform: (node: SceneNode) => Matrix
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

export function parseGuidOrNull(value: string) {
  return /^\d+:\d+$/.test(value) ? stringToGuid(value) : null
}

export function resolveInstanceComponentId(
  context: SceneNodeToKiwiContext,
  componentId: string
): string {
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

export function getOrCreateNodeGuid(
  context: SceneNodeToKiwiContext,
  nodeId: string,
  localIdCounter: { value: number }
): GUID | undefined {
  const node = context.graph.getNode(nodeId)
  if (!node) return undefined
  const existing = context.nodeIdToGuid?.get(nodeId)
  if (existing) return existing
  const importedGuid = node.source.id ? parseGuidOrNull(node.source.id) : null

  // When source.id maps to a GUID value that is already assigned to a
  // different node (e.g. two nodes from different canvases with the same
  // source.id "1:94"), fall back to the counter to avoid collisions.
  if (importedGuid && context.assignedGuidValues) {
    const key = `${importedGuid.sessionID}:${importedGuid.localID}`
    if (context.assignedGuidValues.has(key)) {
      const guid: GUID = { sessionID: 1, localID: localIdCounter.value++ }
      context.nodeIdToGuid?.set(nodeId, guid)
      context.assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
      return guid
    }
  }

  const guid = importedGuid ?? { sessionID: 1, localID: localIdCounter.value++ }
  context.nodeIdToGuid?.set(nodeId, guid)
  context.assignedGuidValues?.add(`${guid.sessionID}:${guid.localID}`)
  return guid
}

/**
 * Component property IDs ("prop:abc123") never match the Figma GUID shape,
 * so parseGuidOrNull always rejects them — mint a stable synthetic GUID from
 * the shared node-id counter instead, memoized so every def/ref/assignment/
 * variantPropSpec pointing at the same property ID round-trips consistently.
 */
export function getOrCreatePropertyGuid(
  context: SceneNodeToKiwiContext,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  const existing = context.propertyIdToGuid.get(propertyId)
  if (existing) return existing
  const parsed = parseGuidOrNull(propertyId)
  if (parsed) return parsed
  const guid = { sessionID: 1, localID: localIdCounter.value++ }
  context.propertyIdToGuid.set(propertyId, guid)
  context.assignedGuidValues?.add(`${guid.sessionID}:${guid.localID}`)
  return guid
}

export function isDescendantOf(
  context: SceneNodeToKiwiContext,
  nodeId: string,
  ancestorId: string
) {
  let current = context.graph.getNode(nodeId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = context.graph.getNode(current.parentId)
  }
  return false
}

export function applyColorVariableBinding(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  paint: Paint,
  field: string
): Paint {
  const variableId = node.boundVariables[field]
  if (!variableId) return paint
  return {
    ...paint,
    colorVar: {
      dataType: 'ALIAS',
      resolvedDataType: 'COLOR',
      value: { alias: { guid: context.varIdToGuid?.get(variableId) ?? stringToGuid(variableId) } }
    },
    colorVariableBinding: {
      variableID: context.varIdToGuid?.get(variableId) ?? stringToGuid(variableId)
    }
  }
}

/** A node's fills with their colour variable aliases, for the record and for override claims alike. */
export function createFillPaints(context: SceneNodeToKiwiContext, node: SceneNode): Paint[] {
  return node.fills.map((fill, index) =>
    applyColorVariableBinding(context, node, context.fillToKiwiPaint(fill), `fills/${index}/color`)
  )
}

export function createStrokePaints(context: SceneNodeToKiwiContext, node: SceneNode): Paint[] {
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

/** Instances address descendants by override key when one exists, else by node GUID. */
export function instanceGuidResolver(context: SceneNodeToKiwiContext, counter: { value: number }) {
  return (id: string): GUID | undefined => {
    const source = context.graph.getNode(id)
    return (
      (source?.overrideKey ? parseGuidOrNull(source.overrideKey) : null) ??
      getOrCreateNodeGuid(context, id, counter)
    )
  }
}
