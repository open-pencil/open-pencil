import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import {
  parseFigFile,
  exportFigFile,
  compressFigDataSync,
  initCodec,
  SceneGraph
} from '@open-pencil/core'

import { heavy } from '#tests/helpers/test-utils'

setDefaultTimeout(30_000)

const FIXTURES = resolve(import.meta.dir, '../../../../fixtures')

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
