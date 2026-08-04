import { describe, expect, test } from 'bun:test'

import { zipSync } from 'fflate'

import { computeBodyId, computeBodyIdSafe } from '@/app/storage/body-id'

type Entries = Record<string, Uint8Array>

const CANVAS = new Uint8Array([1, 2, 3, 4, 5])
const IMAGE_A = new Uint8Array([9, 9])
const IMAGE_B = new Uint8Array([7, 7, 7])

function archive(entries: Entries): Uint8Array {
  return zipSync(entries, { level: 0 })
}

function metaJson(name: string, createdAt: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ name, createdAt }))
}

describe('computeBodyId', () => {
  test('is stable across saves that differ only in export timestamp', async () => {
    // `fig/export.ts` stamps `createdAt: new Date().toISOString()` into
    // meta.json, so two saves of identical content never share archive bytes.
    // Hashing the container would report every save as a change and re-upload
    // the whole document.
    const first = archive({
      'canvas.fig': CANVAS,
      'meta.json': metaJson('Doc', '2026-01-01T00:00:00.000Z')
    })
    const second = archive({
      'canvas.fig': CANVAS,
      'meta.json': metaJson('Doc', '2026-08-03T11:22:33.000Z')
    })

    expect(await computeBodyId(first, 'fig')).toBe(await computeBodyId(second, 'fig'))
  })

  test('is stable across a rename', async () => {
    const before = archive({
      'canvas.fig': CANVAS,
      'meta.json': metaJson('Before', '2026-01-01T00:00:00.000Z')
    })
    const after = archive({
      'canvas.fig': CANVAS,
      'meta.json': metaJson('After', '2026-01-01T00:00:00.000Z')
    })

    expect(await computeBodyId(before, 'fig')).toBe(await computeBodyId(after, 'fig'))
  })

  test('ignores a regenerated thumbnail', async () => {
    const withThumb = archive({
      'canvas.fig': CANVAS,
      'thumbnail.png': new Uint8Array([1])
    })
    const withOtherThumb = archive({
      'canvas.fig': CANVAS,
      'thumbnail.png': new Uint8Array([2, 2, 2])
    })

    expect(await computeBodyId(withThumb, 'fig')).toBe(await computeBodyId(withOtherThumb, 'fig'))
  })

  test('changes when the canvas payload changes', async () => {
    const before = archive({ 'canvas.fig': CANVAS })
    const after = archive({ 'canvas.fig': new Uint8Array([1, 2, 3, 4, 6]) })

    expect(await computeBodyId(before, 'fig')).not.toBe(await computeBodyId(after, 'fig'))
  })

  test('changes when an embedded image changes', async () => {
    const before = archive({ 'canvas.fig': CANVAS, 'images/a': IMAGE_A })
    const after = archive({ 'canvas.fig': CANVAS, 'images/a': IMAGE_B })

    expect(await computeBodyId(before, 'fig')).not.toBe(await computeBodyId(after, 'fig'))
  })

  test('changes when an image is added', async () => {
    const before = archive({ 'canvas.fig': CANVAS, 'images/a': IMAGE_A })
    const after = archive({ 'canvas.fig': CANVAS, 'images/a': IMAGE_A, 'images/b': IMAGE_B })

    expect(await computeBodyId(before, 'fig')).not.toBe(await computeBodyId(after, 'fig'))
  })

  test('does not depend on archive entry order', async () => {
    const ordered = archive({ 'canvas.fig': CANVAS, 'images/a': IMAGE_A, 'images/b': IMAGE_B })
    const reordered = archive({ 'images/b': IMAGE_B, 'images/a': IMAGE_A, 'canvas.fig': CANVAS })

    expect(await computeBodyId(ordered, 'fig')).toBe(await computeBodyId(reordered, 'fig'))
  })

  test('distinguishes a fig from a deck with identical content', async () => {
    const bytes = archive({ 'canvas.fig': CANVAS })

    expect(await computeBodyId(bytes, 'fig')).not.toBe(await computeBodyId(bytes, 'deck'))
  })

  test('cannot be confused by field boundaries', async () => {
    // Length prefixing: ["ab", "c"] must not hash equal to ["a", "bc"].
    const split = archive({ 'images/ab': new Uint8Array([1]), 'images/c': new Uint8Array([2]) })
    const shifted = archive({ 'images/a': new Uint8Array([1]), 'images/bc': new Uint8Array([2]) })

    expect(await computeBodyId(split, 'fig')).not.toBe(await computeBodyId(shifted, 'fig'))
  })
})

describe('computeBodyIdSafe', () => {
  test('falls back to opaque bytes when the archive cannot be read', async () => {
    const notAZip = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])

    const id = await computeBodyIdSafe(notAZip, 'fig')

    expect(id).toStartWith('sha256:')
    // Still deterministic — a body that cannot be parsed must not look like a
    // new body on every save.
    expect(await computeBodyIdSafe(notAZip, 'fig')).toBe(id)
    expect(await computeBodyIdSafe(new Uint8Array([9, 9]), 'fig')).not.toBe(id)
  })
})
