import { unzipSync } from 'fflate'

import { decodeFigKiwiCanvas } from '@open-pencil/kiwi/fig/parse'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { normalizeDeckCanvasPrelude, readCanvasPrelude } from './prelude'
import { restructureDeckNodeChanges } from './restructure'

export interface DeckParseResult {
  nodeChanges: NodeChange[]
  blobs: Uint8Array[]
  images: Array<[string, Uint8Array]>
  figKiwiVersion: number
  figSchemaDeflated: Uint8Array
  /** Original ZIP `meta.json` when present. */
  metaJson?: string
  /** Original ZIP `thumbnail.png` when present. */
  thumbnailPng?: Uint8Array
  /** Prelude found on `canvas.fig` before normalization. */
  sourcePrelude: string
}

function findCanvasData(entries: Partial<Record<string, Uint8Array>>): Uint8Array | null {
  return entries['canvas.fig'] ?? entries.canvas ?? null
}

/** Unzip and decode a `.deck` archive into design-shaped NodeChanges (one CANVAS per slide). */
export function parseDeckBuffer(buffer: ArrayBuffer | Uint8Array): DeckParseResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let archive: Partial<Record<string, Uint8Array>>
  try {
    archive = unzipSync(bytes)
  } catch {
    throw new Error('Invalid .deck file: not a ZIP archive')
  }

  const canvasData = findCanvasData(archive)
  if (!canvasData) {
    throw new Error(
      `No canvas.fig found in .deck file. Entries: ${Object.keys(archive).join(', ')}`
    )
  }

  const sourcePrelude = readCanvasPrelude(canvasData)
  const normalized = normalizeDeckCanvasPrelude(canvasData)
  const decoded = decodeFigKiwiCanvas(normalized)

  const images = Object.entries(archive)
    .filter(([name]) => name.startsWith('images/') && name !== 'images/')
    .map(([name, data]) => [name.slice('images/'.length), data] as [string, Uint8Array])

  const metaEntry = archive['meta.json']
  const metaJson = metaEntry ? new TextDecoder().decode(metaEntry) : undefined
  const thumbnailPng = archive['thumbnail.png']

  const nodeChanges = restructureDeckNodeChanges(decoded.nodeChanges)

  return {
    nodeChanges,
    blobs: decoded.blobs,
    images,
    figKiwiVersion: decoded.figKiwiVersion,
    figSchemaDeflated: decoded.figSchemaDeflated,
    metaJson,
    thumbnailPng,
    sourcePrelude
  }
}
