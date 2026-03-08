/**
 * Layer 3: WASM Kiwi decoder unit tests.
 * Requires: packages/kiwi-wasm built (bunx wasm-pack build)
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { extractKiwiFixture } from '../helpers/extract-kiwi-fixture'

const FIXTURES = resolve(import.meta.dir, '../fixtures')
const PKG_PATH = resolve(import.meta.dir, '../../packages/kiwi-wasm/pkg')

let wasmDecode: (schemaBytes: Uint8Array, data: Uint8Array) => unknown
let goldFixture: { schemaBytes: Uint8Array; dataRaw: Uint8Array }

beforeAll(async () => {
  const wasmBytes = readFileSync(resolve(PKG_PATH, 'kiwi_wasm_bg.wasm'))
  const mod = await import(
    /* @vite-ignore */ new URL('../../packages/kiwi-wasm/pkg/kiwi_wasm.js', import.meta.url).href
  )
  mod.initSync({ module: wasmBytes })
  wasmDecode = mod.decode_figma_message

  const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
  goldFixture = extractKiwiFixture(buf.buffer as ArrayBuffer)
})

describe('WASM decode_figma_message', () => {
  test('decodes gold-preview to message with nodeChanges', () => {
    const message = wasmDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as {
      type?: string
      nodeChanges?: unknown[]
    }
    expect(message).toBeDefined()
    expect(message.nodeChanges).toBeInstanceOf(Array)
    expect(message.nodeChanges!.length).toBeGreaterThan(0)
  })

  test('message type is NODE_CHANGES', () => {
    const message = wasmDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as { type?: string }
    expect(message.type).toBe('NODE_CHANGES')
  })

  test('nodeChanges have guid and type', () => {
    const message = wasmDecode(goldFixture.schemaBytes, goldFixture.dataRaw) as {
      nodeChanges?: Array<{ guid?: { sessionID?: number; localID?: number }; type?: string }>
    }
    const first = message.nodeChanges![0]
    expect(first.guid).toBeDefined()
    expect(typeof first.guid!.sessionID).toBe('number')
    expect(typeof first.guid!.localID).toBe('number')
    expect(typeof first.type).toBe('string')
  })
})

describe('WASM edge cases', () => {
  test('throws on invalid schema bytes', () => {
    const garbage = new Uint8Array([0xff, 0xff, 0xff])
    expect(() => wasmDecode(garbage, goldFixture.dataRaw)).toThrow()
  })

  test('throws on truncated data', () => {
    const truncated = goldFixture.dataRaw.slice(0, 10)
    expect(() => wasmDecode(goldFixture.schemaBytes, truncated)).toThrow()
  })
})
