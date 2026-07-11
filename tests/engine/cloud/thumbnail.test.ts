import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { extractFigThumbnailPng, isProvisionalCloudThumbnail } from '@/app/cloud/thumbnail'

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

describe('isProvisionalCloudThumbnail', () => {
  test('treats missing and stub-sized payloads as provisional', () => {
    expect(isProvisionalCloudThumbnail(null)).toBe(true)
    expect(isProvisionalCloudThumbnail(undefined)).toBe(true)
    expect(isProvisionalCloudThumbnail(new Uint8Array(0))).toBe(true)
    expect(isProvisionalCloudThumbnail(new Uint8Array(64))).toBe(true)
  })

  test('treats blank-board size band as provisional (heal older B2 uploads)', () => {
    // Matches measured blank board JPEGs (~2.7KB); real content thumbs were ≥6KB.
    expect(isProvisionalCloudThumbnail(new Uint8Array(2739))).toBe(true)
    expect(isProvisionalCloudThumbnail(new Uint8Array(3200))).toBe(true)
  })

  test('accepts larger content thumbs', () => {
    expect(isProvisionalCloudThumbnail(new Uint8Array(6000))).toBe(false)
    expect(isProvisionalCloudThumbnail(new Uint8Array(24_000))).toBe(false)
  })
})
