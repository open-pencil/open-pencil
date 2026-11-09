import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { unzipSync } from 'fflate'

import { parseFigFile, exportFigFile } from '@open-pencil/core/io/formats/fig'
import { compressFigDataSync } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { heavy } from '@open-pencil/test-support/heavy'

import { corePackagePath } from '#core-tests/helpers/paths'
import { FIXTURES } from '@open-pencil/test-support/paths'
setDefaultTimeout(30_000)

const CUSTOM_FIG_KIWI_VERSION = 77

function canvasFigVersion(figData: Uint8Array): number {
  const zip = unzipSync(figData)
  const canvasData = zip['canvas.fig'] ?? zip.canvas
  expect(canvasData).toBeDefined()
  return new DataView(canvasData.buffer, canvasData.byteOffset, canvasData.byteLength).getUint32(
    8,
    true
  )
}

function compressInWorker(message: {
  kind?: 'archive' | 'canvas'
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
  fileKind?: 'design' | 'board'
}): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(pathToFileURL(corePackagePath('src', 'io/formats/fig/export/worker.ts')), {
      type: 'module'
    })
    worker.onmessage = (event: MessageEvent<Uint8Array>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(message, [])
  })
}

describe('fig export compression', () => {
  test('canvas message compresses only the document into a fig-kiwi container', async () => {
    const canvas = await compressInWorker({
      kind: 'canvas',
      schemaDeflated: new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
      kiwiData: new Uint8Array([1, 2, 3, 4, 5]),
      thumbnailPNG: new Uint8Array(),
      metaJSON: '{}',
      images: [],
      figKiwiVersion: 77,
      fileKind: 'design'
    })

    expect(new TextDecoder().decode(canvas.subarray(0, 8))).toBe('fig-kiwi')
    expect(
      new DataView(canvas.buffer, canvas.byteOffset, canvas.byteLength).getUint32(8, true)
    ).toBe(77)
  })

  test('compressFigDataSync produces valid zip', async () => {
    await initCodec()

    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([1, 2, 3, 4, 5])
    const thumbnailPNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const metaJSON = JSON.stringify({ version: 1, app: 'test' })

    const result = compressFigDataSync(schemaDeflated, kiwiData, thumbnailPNG, metaJSON, [])

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(0x50)
    expect(result[1]).toBe(0x4b)
  })

  test('compressFigDataSync with images produces valid zip', async () => {
    await initCodec()

    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([10, 20, 30])
    const thumbnailPNG = new Uint8Array([0x89, 0x50])
    const metaJSON = JSON.stringify({ version: 1, app: 'test' })
    const images = [{ name: 'images/abc123', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) }]

    const result = compressFigDataSync(schemaDeflated, kiwiData, thumbnailPNG, metaJSON, images)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(0x50)
    expect(result[1]).toBe(0x4b)
  })

  test('compression preserves custom fig-kiwi version in sync and worker paths', async () => {
    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([10, 20, 30])
    const thumbnailPNG = new Uint8Array([0x89, 0x50])
    const metaJSON = JSON.stringify({ version: 1, app: 'test' })
    const images: Array<{ name: string; data: Uint8Array }> = []

    const syncResult = compressFigDataSync(
      schemaDeflated,
      kiwiData,
      thumbnailPNG,
      metaJSON,
      images,
      CUSTOM_FIG_KIWI_VERSION
    )
    const workerResult = await compressInWorker({
      schemaDeflated,
      kiwiData,
      thumbnailPNG,
      metaJSON,
      images,
      figKiwiVersion: CUSTOM_FIG_KIWI_VERSION
    })

    expect(canvasFigVersion(syncResult)).toBe(CUSTOM_FIG_KIWI_VERSION)
    expect(canvasFigVersion(workerResult)).toBe(CUSTOM_FIG_KIWI_VERSION)
  })
})

heavy('fig export roundtrip', () => {
  let parsed: SceneGraph

  beforeAll(async () => {
    const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
    parsed = await parseFigFile(buf.buffer as ArrayBuffer)
  })

  test('exportFigFile produces valid .fig', async () => {
    const exported = await exportFigFile(parsed)
    expect(exported).toBeInstanceOf(Uint8Array)
    expect(exported.length).toBeGreaterThan(100)

    expect(exported[0]).toBe(0x50)
    expect(exported[1]).toBe(0x4b)
  })

  test('exported file can be parsed back', async () => {
    const exported = await exportFigFile(parsed)
    const reparsed = await parseFigFile(exported.buffer as ArrayBuffer)
    expect(reparsed).toBeInstanceOf(SceneGraph)
    expect(reparsed.getPages().length).toBeGreaterThan(0)
  })
})
