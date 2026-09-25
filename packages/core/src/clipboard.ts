import { embedClipboardImages, encodeFigmaClipboard } from '@open-pencil/fig/clipboard'
export { parseFigmaClipboard, figmaNodesBounds } from '@open-pencil/fig/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { GUID, NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { appendVariableNodeChanges } from '#core/io/formats/fig/variable-export'

import { shapeTextForClipboard } from './canvas/text/clipboard'
import { prepareClipboardImport } from './clipboard/fig-import'
import {
  sceneNodeToKiwi,
  makeDocumentNodeChange,
  makeCanvasNodeChange,
  buildFontDigestMap
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
  const allocateResource = (id: string, map: Map<string, GUID>) => {
    const guid = { sessionID: 1, localID: localIdCounter.value++ }
    map.set(id, guid)
    assignedGuidValues.add(`1:${guid.localID}`)
  }
  for (const id of [...graph.variableCollections.keys(), ...graph.variables.keys()])
    allocateResource(id, variableIds)
  for (const collection of graph.variableCollections.values())
    for (const mode of collection.modes) {
      if (!modeIds.has(mode.modeId)) allocateResource(mode.modeId, modeIds)
    }
  for (const node of graph.getAllNodes())
    if (node.sharedStyleType) {
      const guid = { sessionID: 1, localID: localIdCounter.value++ }
      nodeIdToGuid.set(node.id, guid)
      assignedGuidValues.add(`1:${guid.localID}`)
    }
  for (let i = 0; i < nodes.length; i++) {
    collectTextNodes(nodes[i])
    nodeChanges.push(
      ...sceneNodeToKiwi(
        nodes[i],
        canvasGuid,
        i,
        localIdCounter,
        graph,
        blobs,
        nodeIdToGuid,
        fontDigestMap,
        variableIds,
        undefined,
        undefined,
        assignedGuidValues,
        undefined,
        modeIds
      )
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
  if (dependencies.size || graph.variableCollections.size)
    nodeChanges.push({
      ...makeCanvasNodeChange(dependencyCanvas, docGuid, '"', 'Clipboard dependencies'),
      internalOnly: true
    })
  for (const component of dependencies.values()) {
    collectTextNodes(component)
    nodeChanges.push(
      ...sceneNodeToKiwi(
        component,
        dependencyCanvas,
        0,
        localIdCounter,
        graph,
        blobs,
        nodeIdToGuid,
        fontDigestMap,
        variableIds,
        undefined,
        undefined,
        assignedGuidValues,
        undefined,
        modeIds
      )
    )
  }

  appendVariableNodeChanges(graph, nodeChanges, dependencyCanvas, variableIds, modeIds)
  const textNodeQueue = [...exportedTextNodes]
  await Promise.all(
    nodeChanges.map(async (change) => {
      if (change.type !== 'TEXT') return
      const source = textNodeQueue.shift()
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
