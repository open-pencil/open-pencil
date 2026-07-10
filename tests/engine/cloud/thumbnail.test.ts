import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { extractFigThumbnailPng } from '@/app/cloud/thumbnail'

import { expectDefined } from '#tests/helpers/assert'

const fixtureFig = join(import.meta.dir, '../../fixtures/gold-preview.fig')

describe('extractFigThumbnailPng', () => {
  test('extracts thumbnail.png from a real Figma fixture', () => {
    const bytes = new Uint8Array(readFileSync(fixtureFig))
    const png = expectDefined(extractFigThumbnailPng(bytes))
    expect(png.byteLength).toBeGreaterThan(256)
    // PNG signature
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  test('returns null for non-zip / empty data', () => {
    expect(extractFigThumbnailPng(new Uint8Array())).toBeNull()
    expect(extractFigThumbnailPng(new TextEncoder().encode('fig-kiwixxxx'))).toBeNull()
  })
})
