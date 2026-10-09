import { fromUint8Array } from 'js-base64'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { parseFigBuffer, type FigParseResult } from './archive'

function compareKeys(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** JSON with code-unit key ordering, ordered arrays and ECMAScript number formatting. */
function canonicalJSON(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Review data contains a non-finite number')
    return JSON.stringify(value)
  }
  if (typeof value !== 'object') throw new TypeError('Review data contains a non-JSON value')
  if (ancestors.has(value)) throw new TypeError('Review data contains a cycle')
  ancestors.add(value)
  try {
    if (value instanceof Uint8Array) return JSON.stringify(fromUint8Array(value))
    if (Array.isArray(value)) {
      return `[${Array.from(value, (item) => canonicalJSON(item, ancestors)).join(',')}]`
    }
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new TypeError('Review data contains a non-JSON object')
    }
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJSON(item, ancestors)}`)
      .join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

/**
 * A versioned review artifact, not an editable document. Each saved record gets one line;
 * images are keyed by archive name, while indexed blobs and all record arrays keep order.
 * Archive metadata, thumbnails, compression, and runtime node IDs are deliberately absent.
 */
export function serializeFigReview(
  document: Pick<FigParseResult, 'nodeChanges' | 'blobs' | 'images'>
): string {
  const records = new Map<string, NodeChange>()
  for (const node of document.nodeChanges) {
    if (!node.guid) throw new Error('Cannot review a FIG record without a GUID')
    const id = `${node.guid.sessionID}:${node.guid.localID}`
    if (records.has(id)) throw new Error(`Duplicate FIG record GUID: ${id}`)
    records.set(id, node)
  }
  const images = new Map<string, Uint8Array>()
  for (const [name, bytes] of document.images) {
    if (images.has(name)) throw new Error(`Duplicate FIG image name: ${name}`)
    images.set(name, bytes)
  }
  const lines = [
    '{',
    '  "format": "open-pencil-fig-review",',
    '  "version": 1,',
    `  "blobs": ${canonicalJSON(document.blobs)},`,
    `  "images": ${canonicalJSON(Object.fromEntries(images))},`,
    '  "nodes": {'
  ]
  const entries = [...records].sort(([a], [b]) => compareKeys(a, b))
  for (const [index, [id, node]] of entries.entries()) {
    lines.push(
      `    ${JSON.stringify(id)}: ${canonicalJSON(node)}${index < entries.length - 1 ? ',' : ''}`
    )
  }
  lines.push('  }', '}', '')
  return lines.join('\n')
}

/** Decode every archive record without materializing runtime layers or loading CanvasKit. */
export function createFigReview(buffer: ArrayBuffer): string {
  return serializeFigReview(parseFigBuffer(buffer))
}
