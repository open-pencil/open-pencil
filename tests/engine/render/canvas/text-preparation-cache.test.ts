import { describe, expect, test } from 'bun:test'

import type { CanvasKit, Paragraph } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { buildParagraph, nodeFontReadiness } from '#core/canvas/text'
import type { ParagraphNode } from '#core/canvas/text/paragraph-inputs'
import { TextPreparationCache } from '#core/canvas/text/preparation-cache'
import { fontManager } from '#core/text/fonts'

async function fixture(maxEntries = 8, maxUnits = 1000) {
  const ck = await initCanvasKit()
  const provider = ck.TypefaceFontProvider.Make()
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Prepared text',
    width: 200,
    height: 50
  })
  const cache = new TextPreparationCache(maxEntries, maxUnits)
  const built: Paragraph[] = []
  function build() {
    const builder = ck.ParagraphBuilder.MakeFromFontProvider(
      new ck.ParagraphStyle({ textStyle: { fontSize: 16 } }),
      provider
    )
    builder.addText(node.text)
    const paragraph = builder.build()
    builder.delete()
    paragraph.layout(node.width)
    built.push(paragraph)
    return paragraph
  }
  function use(variant = 'draw', generation = 1) {
    return cache.use(node, variant, generation, provider, build, ({ paragraph }) =>
      paragraph.getHeight()
    )
  }
  return {
    ck,
    provider,
    graph,
    node,
    cache,
    built,
    build,
    use,
    dispose() {
      cache.clear()
      provider.delete()
    }
  }
}

describe('text preparation cache', () => {
  test('does not repeatedly shape coverage when a dense scan exceeds paragraph capacity', async () => {
    const f = await fixture(8)
    const data = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    f.provider.registerFont(data, 'Inter')
    fontManager.markLoaded('Inter', 'Regular', data)
    let builds = 0
    const ck: CanvasKit = {
      ...f.ck,
      ParagraphBuilder: {
        ...f.ck.ParagraphBuilder,
        MakeFromFontProvider(
          ...args: Parameters<typeof f.ck.ParagraphBuilder.MakeFromFontProvider>
        ) {
          builds++
          return f.ck.ParagraphBuilder.MakeFromFontProvider(...args)
        }
      }
    }
    const renderer = {
      ck,
      fontProvider: f.provider,
      fontsLoaded: true,
      textPreparationCache: f.cache
    }
    const nodes = Array.from({ length: 6 }, (_, i) =>
      f.graph.createNode('TEXT', f.node.parentId, {
        text: `Label ${i}`,
        fontFamily: 'Inter',
        fontWeight: 400,
        width: 100,
        height: 30
      })
    )
    function draw() {
      for (const node of nodes) {
        expect(nodeFontReadiness(renderer, node)).toBe('ready')
        f.cache.use(
          node,
          'draw',
          fontManager.generation(),
          f.provider,
          () => buildParagraph(renderer, node),
          ({ paragraph }) => paragraph.getHeight()
        )
      }
    }
    try {
      draw()
      expect(builds).toBe(12)
      draw()
      const warmBuilds = builds
      draw()
      expect(builds).toBe(warmBuilds)
      f.cache.deleteNode(nodes[0].id)
      draw()
      expect(builds).toBe(warmBuilds + 2)
      f.graph.updateNodePreview(nodes[0].id, { text: 'Edited label' })
      draw()
      expect(builds).toBe(warmBuilds + 4)
      f.cache.clear()
      draw()
      expect(builds).toBe(warmBuilds + 16)
    } finally {
      f.dispose()
    }
  })

  test('scopes successful coverage to fonts, inputs and explicit invalidation', async () => {
    const f = await fixture(2)
    const otherProvider = f.ck.TypefaceFontProvider.Make()
    try {
      f.use('coverage', 1)
      f.cache.recordGlyphCoverage(f.node)
      expect(f.cache.hasGlyphCoverage(f.node, 1, f.provider)).toBe(true)
      expect(f.cache.hasGlyphCoverage(f.node, 2, f.provider)).toBe(false)
      expect(f.cache.hasGlyphCoverage(f.node, 1, otherProvider)).toBe(false)
      f.graph.updateNodePreview(f.node.id, { x: 50, rotation: 20 })
      expect(f.cache.hasGlyphCoverage(f.node, 1, f.provider)).toBe(true)
      f.graph.updateNodePreview(f.node.id, { width: 80 })
      expect(f.cache.hasGlyphCoverage(f.node, 1, f.provider)).toBe(false)
      f.use('coverage', 1)
      f.cache.recordGlyphCoverage(f.node)
      f.cache.deleteNode('unrelated')
      expect(f.cache.hasGlyphCoverage(f.node, 1, f.provider)).toBe(true)
      f.cache.deleteNode('another')
      f.cache.deleteNode('overflow')
      expect(f.cache.hasGlyphCoverage(f.node, 1, f.provider)).toBe(false)
      f.cache.recordGlyphCoverage(f.node)
      f.use('draw', 2)
      expect(f.cache.hasGlyphCoverage(f.node, 2, f.provider)).toBe(false)
    } finally {
      otherProvider.delete()
      f.dispose()
    }
  })

  test('reuses native paragraphs during movement and invalidates text layout inputs', async () => {
    const f = await fixture()
    try {
      f.use()
      f.graph.updateNodePreview(f.node.id, { x: 30, y: 40, rotation: 25 })
      f.use()
      expect(f.built).toHaveLength(1)
      // Exhaustive against the same input type accepted by paragraph construction.
      const mutations: ParagraphNode = {
        text: 'Different text',
        fontFamily: 'Other',
        fontSize: 20,
        fontWeight: 700,
        italic: true,
        fontFeatures: [{ tag: 'liga', enabled: false }],
        fontVariations: [{ axis: 'wght', value: 700 }],
        textLanguage: 'ar',
        textDirection: 'RTL',
        textCase: 'UPPER',
        letterSpacing: 2,
        lineHeight: 30,
        textAlignHorizontal: 'CENTER',
        leadingTrim: 'CAP_HEIGHT',
        textDecoration: 'UNDERLINE',
        textDecorationStyle: 'WAVY',
        textDecorationThickness: 2,
        textDecorationFills: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
        ],
        textTruncation: 'ENDING',
        maxLines: 2,
        textAutoResize: 'WIDTH_AND_HEIGHT',
        width: 100,
        height: 80,
        styleRuns: [{ start: 0, length: 4, style: { fontSize: 24 } }]
      }
      for (const [key, value] of Object.entries(mutations)) {
        const previous = f.built.at(-1)
        f.graph.updateNodePreview(f.node.id, { [key]: value })
        f.use()
        expect(previous?.isDeleted()).toBe(true)
      }
      expect(f.built).toHaveLength(1 + Object.keys(mutations).length)
    } finally {
      f.dispose()
    }
  })

  test('separates drawing/coverage variants and expires observations on font changes', async () => {
    const f = await fixture()
    const otherProvider = f.ck.TypefaceFontProvider.Make()
    try {
      const observe = (generation: number) =>
        f.cache.use(f.node, 'coverage', generation, f.provider, f.build, (prepared) => {
          const previous = prepared.missingGlyphs
          prepared.missingGlyphs = []
          return previous
        })
      expect(observe(1)).toBeUndefined()
      expect(observe(1)).toEqual([])
      f.use('draw:black')
      f.use('draw:blue')
      expect(f.built).toHaveLength(3)
      expect(observe(2)).toBeUndefined()
      expect(f.built.slice(0, 3).every((p) => p.isDeleted())).toBe(true)
      f.cache.use(f.node, 'coverage', 2, otherProvider, f.build, (prepared) => {
        expect(prepared.missingGlyphs).toBeUndefined()
      })
      expect(f.built[3].isDeleted()).toBe(true)
    } finally {
      f.dispose()
      otherProvider.delete()
    }
  })

  test('bounds native resource ownership, removes deleted nodes and clears idempotently', async () => {
    const f = await fixture(2)
    try {
      f.use('a')
      f.use('b')
      f.use('a')
      f.use('c')
      expect(f.built[0].isDeleted()).toBe(false)
      expect(f.built[1].isDeleted()).toBe(true)
      f.cache.deleteNode(f.node.id)
      expect(f.built.every((p) => p.isDeleted())).toBe(true)
      f.use('a')
      f.cache.clear()
      f.cache.clear()
      expect(f.built.every((p) => p.isDeleted())).toBe(true)
    } finally {
      f.dispose()
    }
  })

  test('evicts by aggregate text budget before reaching the paragraph count limit', async () => {
    const f = await fixture(8, 20)
    try {
      f.use('a')
      f.use('b')
      expect(f.built).toHaveLength(2)
      expect(f.built[0].isDeleted()).toBe(true)
      expect(f.built[1].isDeleted()).toBe(false)
      f.use('b')
      expect(f.built).toHaveLength(2)
    } finally {
      f.dispose()
    }
  })

  test('does not retain oversized text and deletes uncached paragraphs after errors', async () => {
    const f = await fixture(8, 2)
    try {
      f.use()
      f.use()
      expect(f.built).toHaveLength(2)
      expect(f.built.every((p) => p.isDeleted())).toBe(true)
      expect(() =>
        f.cache.use(f.node, 'draw', 1, f.provider, f.build, () => {
          throw new Error('draw failed')
        })
      ).toThrow('draw failed')
      expect(f.built.every((p) => p.isDeleted())).toBe(true)
    } finally {
      f.dispose()
    }
  })
})
