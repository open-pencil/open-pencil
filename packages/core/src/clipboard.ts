import { inflateSync, deflateSync } from 'fflate'

import {
  sceneNodeToKiwi,
  buildFigKiwi,
  parseFigKiwiChunks,
  decompressFigKiwiDataAsync
} from './kiwi-serialize'
import { initCodec, getCompiledSchema, getSchemaBytes } from './kiwi/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi/kiwi-schema'
import { nodeChangeToProps, sortChildren } from './kiwi/kiwi-convert'
import { populateAndApplyOverrides } from './kiwi/instance-overrides'
import type { InstanceNodeChange } from './kiwi/instance-overrides'

import type { NodeChange as KiwiNodeChange } from './kiwi/codec'
import type { SceneGraph, SceneNode } from './scene-graph'

interface FigmaClipboardMeta {
  fileKey: string
  pasteID: number
  dataType: string
}

export async function prefetchFigmaSchema(): Promise<void> {
  await initCodec()
}

// --- Paste from Figma ---

export async function parseFigmaClipboard(
  html: string
): Promise<{ nodes: KiwiNodeChange[]; meta: FigmaClipboardMeta; blobs: Uint8Array[] } | null> {
  const metaMatch = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!metaMatch || !bufMatch) return null

  const meta: FigmaClipboardMeta = JSON.parse(atob(metaMatch[1]))
  const binary = Uint8Array.fromBase64(bufMatch[1])

  const chunks = parseFigKiwiChunks(binary)
  if (!chunks) return null

  const schemaBytes = inflateSync(chunks[0])
  const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
  const compiled = compileSchema(schema)
  const dataRaw = await decompressFigKiwiDataAsync(chunks[1])
  const msg = compiled.decodeMessage(dataRaw) as {
    nodeChanges?: KiwiNodeChange[]
    blobs?: Array<{ bytes: Uint8Array | Record<string, number> }>
  }

  const blobs: Uint8Array[] = (msg.blobs ?? []).map((b) =>
    b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
  )

  return { nodes: msg.nodeChanges ?? [], meta, blobs }
}

const NON_VISUAL_TYPES = new Set([
  'DOCUMENT',
  'CANVAS',
  'VARIABLE_SET',
  'VARIABLE',
  'VARIABLE_COLLECTION',
  'STYLE',
  'STYLE_SET',
  'INTERNAL_ONLY_NODE',
  'WIDGET',
  'STAMP',
  'STICKY',
  'SHAPE_WITH_TEXT',
  'CONNECTOR',
  'CODE_BLOCK',
  'TABLE_NODE',
  'TABLE_CELL',
  'SECTION_OVERLAY',
  'SLIDE'
])

function isChildOfVisualNode(nc: KiwiNodeChange, parentTypes: Map<string, string>): boolean {
  const parentId = nc.parentIndex?.guid
    ? `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`
    : null
  return !!parentId && parentTypes.has(parentId) && !NON_VISUAL_TYPES.has(parentTypes.get(parentId) ?? '')
}

export function figmaNodesBounds(
  nodeChanges: KiwiNodeChange[]
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const parentTypes = new Map<string, string>()
  for (const nc of nodeChanges) {
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    parentTypes.set(id, nc.type ?? '')
  }

  for (const nc of nodeChanges) {
    if (!nc.type || NON_VISUAL_TYPES.has(nc.type)) continue
    if (isChildOfVisualNode(nc, parentTypes)) continue

    const x = nc.transform?.m02 ?? 0
    const y = nc.transform?.m12 ?? 0
    const w = nc.size?.x ?? 0
    const h = nc.size?.y ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

interface ClipboardImportMaps {
  guidMap: Map<string, KiwiNodeChange>
  parentMap: Map<string, string>
}

function buildClipboardMaps(nodeChanges: KiwiNodeChange[]): ClipboardImportMaps {
  const guidMap = new Map<string, KiwiNodeChange>()
  const parentMap = new Map<string, string>()
  for (const nc of nodeChanges) {
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    guidMap.set(id, nc)
    if (nc.parentIndex?.guid) {
      parentMap.set(id, `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`)
    }
  }
  return { guidMap, parentMap }
}

function findInternalNodeIds(
  guidMap: Map<string, KiwiNodeChange>,
  parentMap: Map<string, string>
): { internalCanvasIds: Set<string>; internalFigmaIds: Set<string> } {
  const internalCanvasIds = new Set<string>()
  for (const [id, nc] of guidMap) {
    if (nc.type === 'CANVAS' && nc.internalOnly) {
      internalCanvasIds.add(id)
    }
  }

  const internalFigmaIds = new Set<string>()
  function markInternal(id: string) {
    internalFigmaIds.add(id)
    for (const [childId, pid] of parentMap) {
      if (pid === id && !internalFigmaIds.has(childId)) markInternal(childId)
    }
  }
  for (const canvasId of internalCanvasIds) markInternal(canvasId)

  return { internalCanvasIds, internalFigmaIds }
}

function classifyTopLevelNodes(
  guidMap: Map<string, KiwiNodeChange>,
  parentMap: Map<string, string>,
  internalCanvasIds: Set<string>
): { topLevel: string[]; internalTopLevel: string[] } {
  const topLevel: string[] = []
  const internalTopLevel: string[] = []
  for (const [id, nc] of guidMap) {
    if (NON_VISUAL_TYPES.has(nc.type ?? '')) continue
    const parentId = parentMap.get(id)
    if (
      !parentId ||
      !guidMap.has(parentId) ||
      NON_VISUAL_TYPES.has(guidMap.get(parentId)?.type ?? '')
    ) {
      if (parentId && internalCanvasIds.has(parentId)) {
        internalTopLevel.push(id)
      } else {
        topLevel.push(id)
      }
    }
  }
  return { topLevel, internalTopLevel }
}

function remapComponentIds(created: Map<string, string>, graph: SceneGraph): void {
  for (const [, ourId] of created) {
    const node = graph.getNode(ourId)
    if (node?.type !== 'INSTANCE' || !node.componentId) continue
    const ourComponentId = created.get(node.componentId)
    if (ourComponentId) graph.updateNode(ourId, { componentId: ourComponentId })
  }
}

function detachOrphanedInstances(created: Map<string, string>, graph: SceneGraph): void {
  for (const [, ourId] of created) {
    const node = graph.getNode(ourId)
    if (node?.type !== 'INSTANCE') continue
    if (node.childIds.length === 0 && (!node.componentId || !graph.getNode(node.componentId))) {
      graph.updateNode(ourId, { type: 'FRAME', componentId: '' })
    }
  }
}

export function importClipboardNodes(
  nodeChanges: KiwiNodeChange[],
  graph: SceneGraph,
  targetParentId: string,
  offsetX = 0,
  offsetY = 0,
  blobs: Uint8Array[] = []
): string[] {
  const { guidMap, parentMap } = buildClipboardMaps(nodeChanges)
  const { internalCanvasIds, internalFigmaIds } = findInternalNodeIds(guidMap, parentMap)
  const { topLevel, internalTopLevel } = classifyTopLevelNodes(guidMap, parentMap, internalCanvasIds)

  const created = new Map<string, string>()
  const createdIds: string[] = []

  function createNode(figmaId: string, ourParentId: string) {
    if (created.has(figmaId)) return
    const nc = guidMap.get(figmaId)
    if (!nc) return

    const { nodeType, ...props } = nodeChangeToProps(nc, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') return

    if (ourParentId === targetParentId) {
      props.x = (props.x ?? 0) + offsetX
      props.y = (props.y ?? 0) + offsetY
    }

    const node = graph.createNode(nodeType, ourParentId, props)

    created.set(figmaId, node.id)
    if (ourParentId === targetParentId && !internalFigmaIds.has(figmaId)) createdIds.push(node.id)

    const children: string[] = []
    for (const [childId, pid] of parentMap) {
      if (pid === figmaId && !NON_VISUAL_TYPES.has(guidMap.get(childId)?.type ?? '')) {
        children.push(childId)
      }
    }
    sortChildren(children, nc, guidMap)
    for (const childId of children) {
      createNode(childId, node.id)
    }
  }

  for (const id of internalTopLevel) {
    createNode(id, targetParentId)
  }
  for (const id of topLevel) {
    createNode(id, targetParentId)
  }

  remapComponentIds(created, graph)

  populateAndApplyOverrides(
    graph,
    guidMap as unknown as Map<string, InstanceNodeChange>,
    created,
    blobs
  )

  for (const figmaId of internalTopLevel) {
    const ourId = created.get(figmaId)
    if (ourId) graph.deleteNode(ourId)
  }

  detachOrphanedInstances(created, graph)

  return createdIds
}

export function buildFigmaClipboardHTML(nodes: SceneNode[], graph: SceneGraph): string | null {
  const compiled = getCompiledSchema()
  const schemaDeflated = deflateSync(getSchemaBytes())

  const docGuid = { sessionID: 0, localID: 0 }
  const canvasGuid = { sessionID: 0, localID: 1 }
  const localIdCounter = { value: 100 }

  const nodeChanges: KiwiNodeChange[] = [
    {
      guid: docGuid,
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    },
    {
      guid: canvasGuid,
      parentIndex: { guid: docGuid, position: '!' },
      type: 'CANVAS',
      name: 'Page 1',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
  ]

  const blobs: Uint8Array[] = []
  for (let i = 0; i < nodes.length; i++) {
    nodeChanges.push(...sceneNodeToKiwi(nodes[i], canvasGuid, i, localIdCounter, graph, blobs))
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID: crypto.getRandomValues(new Int32Array(1))[0],
    pasteFileKey: 'openpencil',
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const dataRaw = compiled.encodeMessage(msg)
  const figKiwiBinary = buildFigKiwi(schemaDeflated, dataRaw)
  const bufferB64 = figKiwiBinary.toBase64()

  const meta: FigmaClipboardMeta = {
    fileKey: 'openpencil',
    pasteID: msg.pasteID as number,
    dataType: 'scene'
  }
  const metaB64 = btoa(JSON.stringify(meta))

  return (
    `<meta charset='utf-8'>` +
    `<span data-metadata="<!--(figmeta)${metaB64}(/figmeta)-->"></span>` +
    `<span data-buffer="<!--(figma)${bufferB64}(/figma)-->"></span>`
  )
}

// --- Internal copy/paste (OpenPencil ↔ OpenPencil) ---

export function parseOpenPencilClipboard(
  html: string
): Array<SceneNode & { children?: SceneNode[] }> | null {
  const match = html.match(/<!--\(openpencil\)(.*?)\(\/openpencil\)-->/s)
  if (!match) return null

  try {
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.fromBase64(match[1])))
    if (decoded.format === 'openpencil/v1' && Array.isArray(decoded.nodes)) {
      restoreTextPictures(decoded.nodes)
      return decoded.nodes
    }
  } catch {
    // Not our format
  }
  return null
}

function restoreTextPictures(nodes: Array<Record<string, unknown>>): void {
  for (const node of nodes) {
    if (typeof node.textPicture === 'string') {
      node.textPicture = Uint8Array.fromBase64(node.textPicture)
    }
    if (Array.isArray(node.children)) {
      restoreTextPictures(node.children)
    }
  }
}

export type TextPictureBuilder = (node: SceneNode) => Uint8Array | null

export function buildOpenPencilClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph,
  textPictureBuilder?: TextPictureBuilder
): string {
  const data = {
    format: 'openpencil/v1',
    nodes: collectNodeTree(nodes, graph, textPictureBuilder)
  }
  return `<!--(openpencil)${new TextEncoder().encode(JSON.stringify(data)).toBase64()}(/openpencil)-->`
}

function collectNodeTree(
  nodes: SceneNode[],
  graph: SceneGraph,
  textPictureBuilder?: TextPictureBuilder
): Array<Record<string, unknown>> {
  return nodes.map((node) => {
    const children = graph.getChildren(node.id)
    const serialized: Record<string, unknown> = { ...node }

    if (node.type === 'TEXT' && node.text && textPictureBuilder) {
      const pic = node.textPicture ?? textPictureBuilder(node)
      if (pic) serialized.textPicture = pic.toBase64()
    } else {
      delete serialized.textPicture
    }

    if (children.length > 0) {
      serialized.children = collectNodeTree(children, graph, textPictureBuilder)
    }
    return serialized
  })
}
