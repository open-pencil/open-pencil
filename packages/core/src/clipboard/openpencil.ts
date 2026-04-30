import { deflateSync, inflateSync } from 'fflate'

import type { SceneGraph, SceneNode } from '#core/scene-graph'

// --- Internal copy/paste (OpenPencil ↔ OpenPencil) ---

export interface OpenPencilClipboardData {
  nodes: Array<SceneNode & { children?: SceneNode[] }>
  images: Map<string, Uint8Array>
}

export function parseOpenPencilClipboard(html: string): OpenPencilClipboardData | null {
  const match = html.match(/<!--\(openpencil\)(.*?)\(\/openpencil\)-->/s)
  if (!match) return null

  try {
    const raw = Uint8Array.fromBase64(match[1])
    let bytes: Uint8Array
    try {
      bytes = inflateSync(raw)
    } catch {
      bytes = raw
    }
    const decoded = JSON.parse(new TextDecoder().decode(bytes))
    if (decoded.format === 'openpencil/v1' && Array.isArray(decoded.nodes)) {
      restoreTextPictures(decoded.nodes)
      const images = new Map<string, Uint8Array>()
      if (decoded.images && typeof decoded.images === 'object') {
        for (const [hash, b64] of Object.entries(decoded.images)) {
          if (typeof b64 === 'string') {
            images.set(hash, Uint8Array.fromBase64(b64))
          }
        }
      }
      return { nodes: decoded.nodes, images }
    }
  } catch (e) {
    console.warn('Failed to parse OpenPencil clipboard data:', e)
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

function collectImageHashes(nodes: SceneNode[], graph: SceneGraph): Set<string> {
  const hashes = new Set<string>()
  function walk(nodeList: SceneNode[]) {
    for (const node of nodeList) {
      for (const fill of node.fills) {
        if (fill.imageHash) hashes.add(fill.imageHash)
      }
      walk(graph.getChildren(node.id))
    }
  }
  walk(nodes)
  return hashes
}

export function buildOpenPencilClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph,
  textPictureBuilder?: TextPictureBuilder
): string {
  const nodeTree = collectNodeTree(nodes, graph, textPictureBuilder)
  const hashes = collectImageHashes(nodes, graph)
  const images: Record<string, string> = {}
  for (const hash of hashes) {
    const bytes = graph.images.get(hash)
    if (bytes) images[hash] = bytes.toBase64()
  }
  const data = {
    format: 'openpencil/v1',
    nodes: nodeTree,
    images
  }
  const compressed = deflateSync(new TextEncoder().encode(JSON.stringify(data)))
  return `<!--(openpencil)${compressed.toBase64()}(/openpencil)-->`
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
