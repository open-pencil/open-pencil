/**
 * Layer 4: JS vs WASM equivalence tests.
 * Ensures both decoders produce semantically equivalent FigmaMessage output
 * that importNodeChanges can consume to build the same SceneGraph.
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { decodeBinarySchema, compileSchema, ByteBuffer } from '../../packages/core/src/kiwi/kiwi-schema'
import { importNodeChanges } from '../../packages/core/src/kiwi/fig-import'
import { extractKiwiFixture } from '../helpers/extract-kiwi-fixture'

const FIXTURES = resolve(import.meta.dir, '../fixtures')
const PKG_PATH = resolve(import.meta.dir, '../../packages/kiwi-wasm/pkg')

let jsDecode: (schemaBytes: Uint8Array, dataRaw: Uint8Array) => unknown
let wasmDecode: (schemaBytes: Uint8Array, data: Uint8Array) => unknown
let goldFixture: { schemaBytes: Uint8Array; dataRaw: Uint8Array }

beforeAll(async () => {
  jsDecode = (schemaBytes: Uint8Array, dataRaw: Uint8Array) => {
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    return compiled.decodeMessage(dataRaw)
  }

  const wasmBytes = readFileSync(resolve(PKG_PATH, 'kiwi_wasm_bg.wasm'))
  const mod = await import(
    /* @vite-ignore */ new URL('../../packages/kiwi-wasm/pkg/kiwi_wasm.js', import.meta.url).href
  )
  mod.initSync({ module: wasmBytes })
  wasmDecode = mod.decode_figma_message

  const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
  goldFixture = extractKiwiFixture(buf.buffer as ArrayBuffer)
})

describe('JS vs WASM equivalence', () => {
  test('gold-preview: both produce same message structure', () => {
    const jsMsg = jsDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as Record<string, unknown>
    const wasmMsg = wasmDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as Record<string, unknown>

    expect(jsMsg.type).toBe(wasmMsg.type)
    expect(jsMsg.nodeChanges).toBeDefined()
    expect(wasmMsg.nodeChanges).toBeDefined()
    expect(Array.isArray(jsMsg.nodeChanges)).toBe(true)
    expect(Array.isArray(wasmMsg.nodeChanges)).toBe(true)
    expect((jsMsg.nodeChanges as unknown[]).length).toBe((wasmMsg.nodeChanges as unknown[]).length)
  })

  test('gold-preview: both produce valid SceneGraph via importNodeChanges', () => {
    const jsMsg = jsDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as {
      nodeChanges: unknown[]
      blobs?: Array<{ bytes: Uint8Array }>
    }
    const wasmMsg = wasmDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as {
      nodeChanges: unknown[]
      blobs?: Array<{ bytes: Uint8Array }>
    }

    const blobs: Uint8Array[] = (jsMsg.blobs ?? []).map((b) =>
      b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes) as number[])
    )
    const graphJs = importNodeChanges(jsMsg.nodeChanges, blobs)
    const graphWasm = importNodeChanges(wasmMsg.nodeChanges, blobs)

    expect(graphJs.nodes.size).toBeGreaterThan(0)
    expect(graphWasm.nodes.size).toBeGreaterThan(0)
    expect(graphJs.getPages().length).toBe(graphWasm.getPages().length)
    expect(graphJs.getPages().length).toBeGreaterThan(0)
  })
})
