/**
 * Layer 1: JS Kiwi decoder unit tests.
 * Tests decodeBinarySchema, compileSchema, decodeMessage with real .fig fixtures.
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { decodeBinarySchema, compileSchema, ByteBuffer } from '../../packages/core/src/kiwi/kiwi-schema'
import { extractKiwiFixture } from '../helpers/extract-kiwi-fixture'

import type { FigmaMessage } from '../../packages/core/src/kiwi/codec'

const FIXTURES = resolve(import.meta.dir, '../fixtures')

let goldFixture: { schemaBytes: Uint8Array; dataRaw: Uint8Array }

beforeAll(() => {
  const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
  goldFixture = extractKiwiFixture(buf.buffer as ArrayBuffer)
})

describe('decodeBinarySchema', () => {
  test('parses schema from gold-preview.fig', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    expect(schema).toBeDefined()
    expect(schema.definitions).toBeInstanceOf(Array)
    expect(schema.definitions.length).toBeGreaterThan(0)
  })

  test('schema contains Message and NodeChange definitions', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    const names = new Set(schema.definitions.map((d) => d.name))
    expect(names.has('Message')).toBe(true)
    expect(names.has('NodeChange')).toBe(true)
  })

  test('accepts Uint8Array directly', () => {
    const schema = decodeBinarySchema(goldFixture.schemaBytes)
    expect(schema.definitions.length).toBeGreaterThan(0)
  })
})

describe('compileSchema + decodeMessage', () => {
  test('decodes gold-preview message to FigmaMessage', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    const message = compiled.decodeMessage(goldFixture.dataRaw) as FigmaMessage

    expect(message).toBeDefined()
    expect(message.nodeChanges).toBeInstanceOf(Array)
    expect(message.nodeChanges!.length).toBeGreaterThan(0)
  })

  test('nodeChanges have guid and type', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    const message = compiled.decodeMessage(goldFixture.dataRaw) as FigmaMessage

    const first = message.nodeChanges![0]
    expect(first.guid).toBeDefined()
    expect(first.guid.sessionID).toBeDefined()
    expect(first.guid.localID).toBeDefined()
    expect(typeof first.type).toBe('string')
  })

  test('message type is NODE_CHANGES', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    const message = compiled.decodeMessage(goldFixture.dataRaw) as FigmaMessage

    expect(message.type).toBe('NODE_CHANGES')
  })
})

describe('edge cases', () => {
  test('decodeBinarySchema returns empty schema for empty buffer', () => {
    const schema = decodeBinarySchema(new ByteBuffer(new Uint8Array(0)))
    expect(schema.definitions).toEqual([])
  })

  test('decodeBinarySchema throws on garbage bytes', () => {
    const garbage = new Uint8Array([0xff, 0xff, 0xff, 0xff])
    expect(() => decodeBinarySchema(new ByteBuffer(garbage))).toThrow()
  })

  test('decodeMessage throws on truncated data', () => {
    const schema = decodeBinarySchema(new ByteBuffer(goldFixture.schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    const truncated = goldFixture.dataRaw.slice(0, 10)

    expect(() => compiled.decodeMessage(truncated)).toThrow()
  })
})
