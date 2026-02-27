import { decodeBinarySchema, compileSchema, ByteBuffer } from 'kiwi-schema'
import { inflateSync } from 'fflate'

import type { SceneGraph, SceneNode, Fill, Stroke, Color } from './scene-graph'

interface FigmaClipboardMeta {
  fileKey: string
  pasteID: number
  dataType: string
}

interface KiwiNodeChange {
  guid: { sessionID: number; localID: number }
  parentIndex?: { guid: { sessionID: number; localID: number }; position: string }
  type?: string
  name?: string
  visible?: boolean
  opacity?: number
  size?: { x: number; y: number }
  transform?: { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number }
  fillPaints?: Array<{ type: string; color?: Color; opacity?: number; visible?: boolean }>
  strokePaints?: Array<{ type: string; color?: Color; opacity?: number; visible?: boolean }>
  strokeWeight?: number
  cornerRadius?: number
  rectangleCornerRadiiIndependent?: boolean
  rectangleTopLeftCornerRadius?: number
  rectangleTopRightCornerRadius?: number
  rectangleBottomLeftCornerRadius?: number
  rectangleBottomRightCornerRadius?: number
  fontSize?: number
  fontName?: { family: string; style: string }
  textData?: { characters: string }
  textAlignHorizontal?: string
  [key: string]: unknown
}

// --- Paste from Figma ---

export async function parseFigmaClipboard(
  html: string
): Promise<{ nodes: KiwiNodeChange[]; meta: FigmaClipboardMeta } | null> {
  const metaMatch = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!metaMatch || !bufMatch) return null

  const meta: FigmaClipboardMeta = JSON.parse(atob(metaMatch[1]))
  const binary = Uint8Array.from(atob(bufMatch[1]), (c) => c.charCodeAt(0))

  const header = new TextDecoder().decode(binary.slice(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
  let offset = 12 // skip magic(8) + version(4)

  const chunks: Uint8Array[] = []
  while (offset < binary.length) {
    const chunkLen = view.getUint32(offset, true)
    offset += 4
    chunks.push(binary.slice(offset, offset + chunkLen))
    offset += chunkLen
  }

  if (chunks.length < 2) return null

  const schemaBytes = inflateSync(chunks[0])
  let dataBytes: Uint8Array
  try {
    dataBytes = inflateSync(chunks[1])
  } catch {
    const fzstd = await import('fzstd')
    dataBytes = fzstd.decompress(chunks[1])
  }

  const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
  const compiled = compileSchema(schema)
  const msg = compiled.decodeMessage(dataBytes) as { nodeChanges?: KiwiNodeChange[] }

  return { nodes: msg.nodeChanges ?? [], meta }
}

export function importClipboardNodes(
  nodeChanges: KiwiNodeChange[],
  graph: SceneGraph,
  targetParentId: string,
  offsetX = 0,
  offsetY = 0
): string[] {
  // Build parent map
  const guidMap = new Map<string, KiwiNodeChange>()
  const parentMap = new Map<string, string>()
  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    guidMap.set(id, nc)
    if (nc.parentIndex?.guid) {
      parentMap.set(id, `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`)
    }
  }

  // Find top-level nodes (skip DOCUMENT and CANVAS, find their children)
  const skipTypes = new Set(['DOCUMENT', 'CANVAS'])
  const topLevel: string[] = []
  for (const [id, nc] of guidMap) {
    if (skipTypes.has(nc.type ?? '')) continue
    const parentId = parentMap.get(id)
    if (!parentId || !guidMap.has(parentId) || skipTypes.has(guidMap.get(parentId)?.type ?? '')) {
      topLevel.push(id)
    }
  }

  const created = new Map<string, string>() // figma guid → our node id
  const createdIds: string[] = []

  function createNode(figmaId: string, ourParentId: string) {
    if (created.has(figmaId)) return
    const nc = guidMap.get(figmaId)
    if (!nc) return

    const x = (nc.transform?.m02 ?? 0) + (ourParentId === targetParentId ? offsetX : 0)
    const y = (nc.transform?.m12 ?? 0) + (ourParentId === targetParentId ? offsetY : 0)

    let rotation = 0
    if (nc.transform) {
      rotation = Math.atan2(nc.transform.m10, nc.transform.m00) * (180 / Math.PI)
    }

    const fills: Fill[] = (nc.fillPaints ?? [])
      .filter((p) => p.type === 'SOLID' && p.color)
      .map((p) => ({
        type: 'SOLID' as const,
        color: p.color!,
        opacity: p.opacity ?? 1,
        visible: p.visible ?? true
      }))

    const strokes: Stroke[] = (nc.strokePaints ?? [])
      .filter((p) => p.type === 'SOLID' && p.color)
      .map((p) => ({
        color: p.color!,
        weight: nc.strokeWeight ?? 1,
        opacity: p.opacity ?? 1,
        visible: p.visible ?? true,
        align: 'CENTER' as const
      }))

    const nodeType = mapType(nc.type)
    const node = graph.createNode(nodeType, ourParentId, {
      name: nc.name ?? nodeType,
      x,
      y,
      width: nc.size?.x ?? 100,
      height: nc.size?.y ?? 100,
      rotation,
      opacity: nc.opacity ?? 1,
      visible: nc.visible ?? true,
      fills,
      strokes,
      cornerRadius: nc.cornerRadius ?? 0,
      independentCorners: nc.rectangleCornerRadiiIndependent ?? false,
      topLeftRadius: nc.rectangleTopLeftCornerRadius ?? 0,
      topRightRadius: nc.rectangleTopRightCornerRadius ?? 0,
      bottomLeftRadius: nc.rectangleBottomLeftCornerRadius ?? 0,
      bottomRightRadius: nc.rectangleBottomRightCornerRadius ?? 0,
      text: nc.textData?.characters ?? '',
      fontSize: nc.fontSize ?? 14,
      fontFamily: nc.fontName?.family ?? 'Inter',
      textAlignHorizontal:
        (nc.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED') ?? 'LEFT'
    })

    created.set(figmaId, node.id)
    if (ourParentId === targetParentId) createdIds.push(node.id)

    // Create children
    const children: string[] = []
    for (const [childId, pid] of parentMap) {
      if (pid === figmaId && !skipTypes.has(guidMap.get(childId)?.type ?? '')) {
        children.push(childId)
      }
    }
    children.sort((a, b) => {
      const aPos = guidMap.get(a)?.parentIndex?.position ?? ''
      const bPos = guidMap.get(b)?.parentIndex?.position ?? ''
      return aPos.localeCompare(bPos)
    })
    for (const childId of children) {
      createNode(childId, node.id)
    }
  }

  for (const id of topLevel) {
    createNode(id, targetParentId)
  }

  return createdIds
}

function mapType(type?: string): SceneNode['type'] {
  switch (type) {
    case 'FRAME':
    case 'COMPONENT':
    case 'COMPONENT_SET':
    case 'INSTANCE':
      return 'FRAME'
    case 'RECTANGLE':
    case 'ROUNDED_RECTANGLE':
      return 'RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'REGULAR_POLYGON':
      return 'POLYGON'
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      return 'VECTOR'
    case 'GROUP':
      return 'GROUP'
    case 'SECTION':
      return 'SECTION'
    default:
      return 'RECTANGLE'
  }
}

// --- Copy to Figma-compatible clipboard ---

export function buildFigmaClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph
): string {
  const meta: FigmaClipboardMeta = {
    fileKey: 'openpencil',
    pasteID: Math.floor(Math.random() * 2147483647),
    dataType: 'scene'
  }

  const metaB64 = btoa(JSON.stringify(meta) + '\n')

  const internalData = {
    format: 'openpencil/v1',
    nodes: collectNodeTree(nodes, graph)
  }
  const dataB64 = btoa(JSON.stringify(internalData))

  const html =
    `<meta charset='utf-8'>` +
    `<span data-metadata="<!--(figmeta)${metaB64}(/figmeta)-->"></span>` +
    `<span data-buffer="<!--(figma)${dataB64}(/figma)-->"></span>`

  return html
}

function collectNodeTree(
  nodes: SceneNode[],
  graph: SceneGraph
): Array<SceneNode & { children?: SceneNode[] }> {
  return nodes.map((node) => {
    const children = graph.getChildren(node.id)
    return {
      ...node,
      children: children.length > 0 ? collectNodeTree(children, graph) : undefined
    }
  })
}

// --- Parse our own format back ---

export function parseOpenPencilClipboard(
  html: string
): Array<SceneNode & { children?: SceneNode[] }> | null {
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!bufMatch) return null

  try {
    const decoded = JSON.parse(atob(bufMatch[1]))
    if (decoded.format === 'openpencil/v1' && Array.isArray(decoded.nodes)) {
      return decoded.nodes
    }
  } catch {
    // Not our format
  }
  return null
}
