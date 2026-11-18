import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { corePackagePath } from '#core-tests/helpers/paths'

import { parseFigFile, exportFigFile, type FigCanvasParts } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { heavy } from '@open-pencil/test-support/heavy'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { buildFigCanvas } from '#core/io/formats/fig/export/compress'
setDefaultTimeout(30_000)

function compressInWorker(parts: FigCanvasParts): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      pathToFileURL(corePackagePath('src', 'io/formats/fig/export/worker.ts')),
      {
        type: 'module'
      }
    )
    worker.onmessage = (event: MessageEvent<Uint8Array>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(parts, [])
  })
}

describe('fig export compression', () => {
  test('the worker compresses the document data into a fig-kiwi container of its version', async () => {
    const parts: FigCanvasParts = {
      schemaDeflated: new Uint8Array([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
      kiwiData: new Uint8Array([1, 2, 3, 4, 5]),
      figKiwiVersion: 77,
      kind: 'design'
    }
    const canvas = await compressInWorker(parts)

    expect(new TextDecoder().decode(canvas.subarray(0, 8))).toBe('fig-kiwi')
    expect(
      new DataView(canvas.buffer, canvas.byteOffset, canvas.byteLength).getUint32(8, true)
    ).toBe(77)
    expect(canvas).toEqual(await buildFigCanvas(parts))
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
