import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'

import { unzipSync } from 'fflate'

import {
  parseFigFile,
  exportFigFile,
  compressFigDataSync,
  initCodec,
  SceneGraph
} from '@open-pencil/core'

import { readFixtureArrayBuffer, uint8ArrayToArrayBuffer } from '#tests/helpers/fig-fixtures'
import { heavy } from '#tests/helpers/test-utils'

const FIG_EXPORT_ROUNDTRIP_TIMEOUT_MS = 120_000

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
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPng: Uint8Array
  metaJson: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
}): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../../../../../packages/core/src/io/formats/fig/export-worker.ts', import.meta.url),
      { type: 'module' }
    )
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
  test('compressFigDataSync produces valid zip', async () => {
    await initCodec()

    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([1, 2, 3, 4, 5])
    const thumbnailPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const metaJson = JSON.stringify({ version: 1, app: 'test' })

    const result = compressFigDataSync(schemaDeflated, kiwiData, thumbnailPng, metaJson, [])

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(0x50)
    expect(result[1]).toBe(0x4b)
  })

  test('compressFigDataSync with images produces valid zip', async () => {
    await initCodec()

    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([10, 20, 30])
    const thumbnailPng = new Uint8Array([0x89, 0x50])
    const metaJson = JSON.stringify({ version: 1, app: 'test' })
    const images = [{ name: 'images/abc123', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) }]

    const result = compressFigDataSync(schemaDeflated, kiwiData, thumbnailPng, metaJson, images)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(0x50)
    expect(result[1]).toBe(0x4b)
  })

  test('compression preserves custom fig-kiwi version in sync and worker paths', async () => {
    const schemaDeflated = new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])
    const kiwiData = new Uint8Array([10, 20, 30])
    const thumbnailPng = new Uint8Array([0x89, 0x50])
    const metaJson = JSON.stringify({ version: 1, app: 'test' })
    const images: Array<{ name: string; data: Uint8Array }> = []

    const syncResult = compressFigDataSync(
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
      images,
      CUSTOM_FIG_KIWI_VERSION
    )
    const workerResult = await compressInWorker({
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
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
    parsed = await parseFigFile(readFixtureArrayBuffer('gold-preview.fig'))
  })

  test('exportFigFile produces valid .fig', async () => {
    const exported = await exportFigFile(parsed)
    expect(exported).toBeInstanceOf(Uint8Array)
    expect(exported.length).toBeGreaterThan(100)

    expect(exported[0]).toBe(0x50)
    expect(exported[1]).toBe(0x4b)
  })

  test(
    'exported file can be parsed back',
    async () => {
      const exported = await exportFigFile(parsed)
      const reparsed = await parseFigFile(uint8ArrayToArrayBuffer(exported))
      expect(reparsed).toBeInstanceOf(SceneGraph)
      expect(reparsed.getPages().length).toBeGreaterThan(0)
    },
    FIG_EXPORT_ROUNDTRIP_TIMEOUT_MS
  )
})
