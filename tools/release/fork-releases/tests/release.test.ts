import { describe, expect, test } from 'bun:test'

import { parseChecksums } from '#fork-releases/release'

describe('parseChecksums', () => {
  test('reads text and binary mode lines and refuses anything else', () => {
    const hash = 'c'.repeat(64)
    expect(parseChecksums(`${hash}  a.js\n${hash} *b.wasm\n`)).toEqual({
      'a.js': hash,
      'b.wasm': hash
    })
    expect(() => parseChecksums('not a checksum line')).toThrow(/SHA256SUMS/)
  })
})
