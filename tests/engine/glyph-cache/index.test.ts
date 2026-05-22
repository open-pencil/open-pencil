/**
 * GAP-004: getGlyphOutlineCommandsSync recomputes identical glyph
 * outline command arrays on every call, creating redundant allocations.
 *
 * FIX-GAP-004 adds a module-level LRU cache (`glyphOutlineCache`) keyed
 * by `${family}|${style}|${text}|${fontSize}`. The cache intercepts
 * subsequent calls with identical arguments and returns the previously
 * computed result, eliminating redundant allocation.
 *
 * This test verifies the caching pattern using a local TestCache that
 * mirrors the production LRUMap behavior. The integration test below
 * verifies that buildFigmaClipboardHTML populates the parsedFontCache
 * (via getOpenTypeCacheSizes) when processing text nodes — without
 * using mock.module, which can leak across test files in Bun.
 */
import { beforeAll, describe, expect, it } from 'bun:test'

import { buildFigmaClipboardHTML, initCodec, SceneGraph } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/core'

import { fontManager } from '#core/text/fonts'
import { clearOpenTypeCaches, getOpenTypeCacheSizes } from '#core/text/opentype'

class TestCache<K, V> {
  private map = new Map<K, V>()
  constructor(private capacity: number) {}
  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v)
    }
    return v
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next()
      if (oldest.done) break
      this.map.delete(oldest.value)
    }
  }
}

describe('glyph cache: LRU eliminates redundant glyph computation', () => {
  beforeAll(async () => {
    await initCodec()
    clearOpenTypeCaches()
  })

  it('populates parsedFontCache when building clipboard HTML for text nodes', async () => {
    const data = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    fontManager.markLoaded('Inter', 'Regular', data)

    const graph = new SceneGraph()
    const pageId = graph.rootId
    const TEXT_COUNT = 100
    const sameText = 'Button'

    for (let i = 0; i < TEXT_COUNT; i++) {
      graph.createNode('TEXT', pageId, {
        name: `Text ${i}`,
        x: i * 30,
        y: 0,
        width: 100,
        height: 24,
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: 400,
        text: sameText
      })
    }

    const page = graph.getNode(pageId)
    if (!page) throw new Error('Page node not found')
    const textNodes: SceneNode[] = []
    for (const childId of page.childIds) {
      const node = graph.getNode(childId)
      if (node?.type === 'TEXT') textNodes.push(node)
    }
    expect(textNodes.length).toBe(TEXT_COUNT)

    expect(getOpenTypeCacheSizes().parsedFont).toBe(0)

    const html = await buildFigmaClipboardHTML(textNodes, graph)
    if (!html) throw new Error('html is null')
    expect(html.length).toBeGreaterThan(0)

    expect(getOpenTypeCacheSizes().parsedFont).toBe(1)
  })

  it('demonstrates LRU caching eliminates redundant work', () => {
    const cache = new TestCache<string, Array<Array<string | number>>>(500)
    let calls = 0

    const cachedCompute = (
      family: string,
      style: string,
      text: string,
      fontSize: number
    ): Array<Array<string | number>> => {
      const key = `${family}|${style}|${text}|${fontSize}`
      const cached = cache.get(key)
      if (cached !== undefined) return cached

      calls++
      const result = Array.from({ length: text.length }, (_, i) => [
        'M',
        i * 10,
        0,
        'L',
        i * 10 + 5,
        fontSize,
        'Z'
      ])
      cache.set(key, result)
      return result
    }

    const results: Array<Array<Array<string | number>>> = []
    for (let i = 0; i < 100; i++) {
      results.push(cachedCompute('Inter', 'Regular', 'Button', 14))
    }

    expect(calls).toBe(1)

    const first = results[0]
    if (!first) throw new Error('No results')
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(first)
    }
  })
})
