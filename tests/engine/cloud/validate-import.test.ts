import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  validateDesignImportBytes,
  validateFigBytes,
  validatePenBytes
} from '@/app/cloud/validate-import'

const fixtureFig = join(import.meta.dir, '../../fixtures/gold-preview.fig')

describe('validateFigBytes', () => {
  test('accepts a real Figma ZIP fixture', () => {
    const bytes = new Uint8Array(readFileSync(fixtureFig))
    expect(validateFigBytes(bytes)).toEqual({ ok: true })
  })

  test('accepts raw fig-kiwi payload', () => {
    const raw = new TextEncoder().encode('fig-kiwi' + '\0'.repeat(8))
    expect(validateFigBytes(raw).ok).toBe(true)
  })

  test('rejects empty / random / plain text', () => {
    expect(validateFigBytes(new Uint8Array()).ok).toBe(false)
    expect(validateFigBytes(new TextEncoder().encode('hello world')).ok).toBe(false)
    expect(validateFigBytes(new TextEncoder().encode('{"foo":1}')).ok).toBe(false)
  })

  test('rejects a ZIP that is not a Figma document', () => {
    // Minimal empty ZIP (end of central directory only) — not a fig container.
    const emptyZip = Uint8Array.from([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ])
    expect(validateFigBytes(emptyZip).ok).toBe(false)
  })
})

describe('validatePenBytes', () => {
  test('accepts a minimal pen document shape', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        version: '2.6',
        children: [{ type: 'frame', id: '1', name: 'Page 1' }]
      })
    )
    expect(validatePenBytes(bytes)).toEqual({ ok: true })
  })

  test('rejects invalid JSON and wrong shapes', () => {
    expect(validatePenBytes(new TextEncoder().encode('not json')).ok).toBe(false)
    expect(validatePenBytes(new TextEncoder().encode('[]')).ok).toBe(false)
    expect(validatePenBytes(new TextEncoder().encode('{"name":"x"}')).ok).toBe(false)
    expect(validatePenBytes(new TextEncoder().encode('{"children":{}}')).ok).toBe(false)
    expect(validatePenBytes(new Uint8Array()).ok).toBe(false)
  })
})

describe('validateDesignImportBytes', () => {
  test('routes by extension', () => {
    const fig = new Uint8Array(readFileSync(fixtureFig))
    expect(validateDesignImportBytes('a.fig', fig).ok).toBe(true)
    expect(
      validateDesignImportBytes('a.pen', new TextEncoder().encode(JSON.stringify({ children: [] })))
        .ok
    ).toBe(true)
    expect(validateDesignImportBytes('a.txt', fig).ok).toBe(false)
  })
})
