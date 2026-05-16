import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

describe('FigmaAPI.createImage', () => {
  test('returns deterministic hash for same bytes', () => {
    const { figma } = setup()
    const a = figma.createImage(PNG_MAGIC)
    const b = figma.createImage(PNG_MAGIC)
    expect(a.hash).toBe(b.hash)
  })

  test('different bytes produce different hashes', () => {
    const { figma } = setup()
    const a = figma.createImage(PNG_MAGIC)
    const b = figma.createImage(JPEG_MAGIC)
    expect(a.hash).not.toBe(b.hash)
  })

  test('stores bytes in graph.images', () => {
    const { graph, figma } = setup()
    const { hash } = figma.createImage(PNG_MAGIC)
    expect(graph.images.get(hash)).toEqual(PNG_MAGIC)
  })

  test('hash is a 40-char hex string', () => {
    const { figma } = setup()
    const { hash } = figma.createImage(PNG_MAGIC)
    expect(hash).toHaveLength(40)
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })

  test('empty data produces a valid hash', () => {
    const { figma } = setup()
    const { hash } = figma.createImage(new Uint8Array([]))
    expect(hash).toHaveLength(40)
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })
})

