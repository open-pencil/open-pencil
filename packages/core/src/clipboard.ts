import { embedClipboardImages, encodeFigmaClipboard } from '@open-pencil/fig/clipboard'
export { parseFigmaClipboard, figmaNodesBounds } from '@open-pencil/fig/clipboard'
import { placeSlotContent } from '@open-pencil/fig/node-change'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { GUID, NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import { ownsSlotContent, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import {
  appendVariableNodeChanges,
  assignSharedStyleGuids,
  assignVariableGuids
} from '#core/io/formats/fig/variable-export'

import { shapeTextForClipboard } from './canvas/text/clipboard'
import { prepareClipboardImport } from './clipboard/fig-import'
import {
  sceneNodeToKiwi,
  makeDocumentNodeChange,
  makeCanvasNodeChange,
  buildFontDigestMap,
  fractionalPosition
} from './kiwi/fig/node-change/serialize'
import { randomInt } from './random'
import { buildDerivedTextDataV4 } from './text/derived-text/clipboard'

export async function prefetchFigmaSchema(): Promise<void> {
  await initCodec()
}

export function importClipboardNodes(
  nodeChanges: KiwiNodeChange[],
  graph: SceneGraph,
  targetParentId: string,
  offsetX = 0,
  offsetY = 0,
  blobs: Uint8Array[] = []
): string[] {
  const operation = prepareClipboardImport(
    nodeChanges,
    graph,
    targetParentId,
    blobs,
    offsetX,
    offsetY
  )
  operation.commit()
  return operation.plan.rootIds
}

export async function buildFigmaClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph
): Promise<string | null> {
  const fontDigestMap = await buildFontDigestMap(graph)

  const docGuid = { sessionID: 0, localID: 0 }
  const canvasGuid = { sessionID: 0, localID: 1 }
  const localIdCounter = { value: 100 }

  const nodeChanges: KiwiNodeChange[] = [
    makeDocumentNodeChange(docGuid, graph.documentColorSpace),
    makeCanvasNodeChange(canvasGuid, docGuid, '!', 'Page 1')
  ]

  const exportedTextNodes: SceneNode[] = []
  const collectTextNodes = (node: SceneNode) => {
    if (node.type === 'TEXT') exportedTextNodes.push(node)
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (child) collectTextNodes(child)
    }
  }

  const nodeIdToGuid = new Map<string, GUID>()
  const assignedGuidValues = new Set<string>()
  const blobs: Uint8Array[] = []
  const variableIds = new Map<string, GUID>()
  const modeIds = new Map<string, GUID>()
  assignVariableGuids(graph, localIdCounter, variableIds, modeIds, assignedGuidValues, new Set())
  assignSharedStyleGuids(
    [...graph.nodes.values()].filter((node) => node.sharedStyleType !== null),
    localIdCounter,
    nodeIdToGuid,
    assignedGuidValues
  )
  const slotContentRecords: KiwiNodeChange[] = []
  for (let i = 0; i < nodes.length; i++) {
    collectTextNodes(nodes[i])
    nodeChanges.push(
      ...sceneNodeToKiwi(nodes[i], canvasGuid, i, localIdCounter, graph, blobs, {
        nodeIdToGuid,
        fontDigestMap,
        varIdToGuid: variableIds,
        assignedGuidValues,
        modeIdToGuid: modeIds,
        slotContentRecords
      })
    )
  }

  const dependencies = new Map<string, SceneNode>()
  const selected = new Set<string>()
  const mark = (node: SceneNode): void => {
    selected.add(node.id)
    for (const child of graph.getChildren(node.id)) mark(child)
  }
  for (const node of nodes) mark(node)
  const visitDependencies = (node: SceneNode): void => {
    if (
      node.type === 'INSTANCE' &&
      node.componentId &&
      !selected.has(node.componentId) &&
      !dependencies.has(node.componentId)
    ) {
      const component = graph.getNode(node.componentId)
      if (!component) throw new Error(`Missing clipboard component ${node.componentId}`)
      dependencies.set(component.id, component)
      visitDependencies(component)
    }
    for (const child of graph.getChildren(node.id)) visitDependencies(child)
  }
  for (const node of nodes) visitDependencies(node)
  for (const node of graph.getAllNodes())
    if (node.sharedStyleType && !selected.has(node.id)) dependencies.set(node.id, node)
  const dependencyCanvas = { sessionID: 0, localID: 2 }
  const hasSlotContent = [...selected].some((id) => {
    const node = graph.getNode(id)
    return !!node && ownsSlotContent(graph, node)
  })
  if (dependencies.size || graph.variableCollections.size || hasSlotContent)
    nodeChanges.push({
      ...makeCanvasNodeChange(dependencyCanvas, docGuid, '"', 'Clipboard dependencies'),
      internalOnly: true
    })
  for (const component of dependencies.values()) {
    collectTextNodes(component)
    nodeChanges.push(
      ...sceneNodeToKiwi(component, dependencyCanvas, 0, localIdCounter, graph, blobs, {
        nodeIdToGuid,
        fontDigestMap,
        varIdToGuid: variableIds,
        assignedGuidValues,
        modeIdToGuid: modeIds,
        slotContentRecords
      })
    )
  }
  appendVariableNodeChanges(graph, nodeChanges, dependencyCanvas, variableIds, modeIds)
  // Slot content is collected while instances serialize; it follows the canvas's other records.
  const written = nodeChanges.filter(
    (change) =>
      change.parentIndex?.guid.sessionID === dependencyCanvas.sessionID &&
      change.parentIndex.guid.localID === dependencyCanvas.localID
  ).length
  placeSlotContent(slotContentRecords, dependencyCanvas, written, fractionalPosition)
  nodeChanges.push(...slotContentRecords)
  // Pair each text record with the node it was written from; instance content and slot
  // content are not emitted in traversal order.
  const textById = new Map(exportedTextNodes.map((node) => [node.id, node]))
  const sourceByGuid = new Map<string, SceneNode>()
  for (const [id, guid] of nodeIdToGuid) {
    const node = textById.get(id)
    if (node) sourceByGuid.set(`${guid.sessionID}:${guid.localID}`, node)
  }
  await Promise.all(
    nodeChanges.map(async (change) => {
      if (change.type !== 'TEXT' || !change.guid) return
      const source = sourceByGuid.get(`${change.guid.sessionID}:${change.guid.localID}`)
      if (!source) return
      change.textAutoResize = 'NONE'
      change.textUserLayoutVersion = 5
      change.lineHeight = {
        value: source.lineHeight ?? 100,
        units: source.lineHeight ? 'PIXELS' : 'PERCENT'
      }
      const shaped = await shapeTextForClipboard(source).catch(() => null)
      change.derivedTextData = await buildDerivedTextDataV4(source, fontDigestMap, shaped, blobs)
    })
  )
  await embedClipboardImages(nodeChanges, blobs, graph.images)
  return encodeFigmaClipboard(nodeChanges, blobs, randomInt())
}

export {
  buildOpenPencilClipboardHTML,
  parseOpenPencilClipboard,
  type OpenPencilClipboardData,
  type TextPictureBuilder
} from './clipboard/openpencil'
