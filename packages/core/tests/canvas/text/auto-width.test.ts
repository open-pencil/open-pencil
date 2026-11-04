import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { measureTextNode } from '#core/canvas/text'
import { buildParagraph } from '#core/canvas/text/layout/build'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { FigmaAPI } from '#core/figma-api'
import { computeAllLayouts } from '#core/layout'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { withTextMeasurer } from '#core/layout/text-measurement'
import { fontManager } from '#core/text/font/manager'

const MAX_WIDTH = 40

let ck: CanvasKit
let provider: TypefaceFontProvider

function renderer(): TextRenderer {
  return { ck, fontProvider: provider, fontsLoaded: true }
}

function autoWidthText(props: Partial<SceneNode>): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Acme quarterly overview',
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: null,
    width: 0,
    height: 0,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props
  })
}

function resized(node: SceneNode): SceneNode {
  const changes = withTextMeasurer(
    (text, maxWidth) => measureTextNode(renderer(), text, maxWidth),
    () => textAutoResizeChanges(node, { text: node.text })
  )
  return { ...node, ...changes }
}

function changed(node: SceneNode, changes: Partial<SceneNode>): SceneNode {
  const sized = withTextMeasurer(
    (text, maxWidth) => measureTextNode(renderer(), text, maxWidth),
    () => textAutoResizeChanges(node, changes)
  )
  return { ...node, ...changes, ...sized }
}

describe('text that sizes its own width', () => {
  beforeAll(async () => {
    ck = await getCanvasKit()
    provider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, provider)
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/InterVariable.ttf'),
      'bundled Inter font'
    )
    provider.registerFont(inter, 'Inter')
    await fontManager.markLoaded('Inter', 'Regular', inter)
  })

  afterAll(() => {
    fontManager.detachProvider(provider)
    provider.delete()
  })

  test('truncates to one line within its max width', () => {
    const singleLine = resized(autoWidthText({}))
    const node = resized(
      autoWidthText({ maxWidth: MAX_WIDTH, textTruncation: 'ENDING', maxLines: 1 })
    )

    expect(node.derivedTextGlyphs).toBeNull()
    expect(node.width).toBeGreaterThan(0)
    expect(node.width).toBeLessThanOrEqual(MAX_WIDTH)
    expect(node.height).toBe(singleLine.height)

    const layout = buildParagraph(renderer(), node)
    try {
      expect(layout.getLineMetrics()).toHaveLength(1)
      expect(layout.didExceedMaxLines()).toBe(true)
      expect(layout.getLongestLine()).toBeLessThanOrEqual(MAX_WIDTH)
    } finally {
      layout.delete()
    }
  })

  test('draws truncated at the width auto layout gives it', () => {
    const node = autoWidthText({
      maxWidth: MAX_WIDTH,
      textTruncation: 'ENDING',
      maxLines: 1,
      width: MAX_WIDTH,
      height: 20
    })

    const layout = buildParagraph(renderer(), node)
    try {
      expect(layout.didExceedMaxLines()).toBe(true)
      expect(layout.getLongestLine()).toBeLessThanOrEqual(MAX_WIDTH)
    } finally {
      layout.delete()
    }
  })

  test('wraps at its max width without truncation', () => {
    const singleLine = resized(autoWidthText({}))
    const node = resized(autoWidthText({ maxWidth: MAX_WIDTH * 3 }))

    expect(node.width).toBeLessThanOrEqual(MAX_WIDTH * 3)
    expect(node.height).toBeGreaterThan(singleLine.height)

    const layout = buildParagraph(renderer(), node)
    try {
      expect(layout.getLineMetrics().length).toBeGreaterThan(1)
      expect(layout.getLongestLine()).toBeLessThanOrEqual(MAX_WIDTH * 3)
    } finally {
      layout.delete()
    }
  })

  test('lets a min width wider than its max width win, as auto layout does', () => {
    const singleLine = resized(autoWidthText({}))
    const node = resized(autoWidthText({ minWidth: MAX_WIDTH * 25, maxWidth: MAX_WIDTH }))

    expect(node.width).toBe(singleLine.width)
    expect(node.height).toBe(singleLine.height)

    const layout = buildParagraph(renderer(), node)
    try {
      expect(layout.getLineMetrics()).toHaveLength(1)
    } finally {
      layout.delete()
    }
  })

  test('keeps its widest line when it has no max width', () => {
    const node = resized(autoWidthText({ textTruncation: 'ENDING', maxLines: 1 }))

    expect(node.width).toBeGreaterThan(MAX_WIDTH * 3)

    const layout = buildParagraph(renderer(), node)
    try {
      expect(layout.getLineMetrics()).toHaveLength(1)
      expect(layout.didExceedMaxLines()).toBe(false)
    } finally {
      layout.delete()
    }
  })

  test('re-measures when only its truncation changes', () => {
    const wrapped = resized(autoWidthText({ maxWidth: MAX_WIDTH * 3, maxLines: 1 }))
    const truncated = changed(wrapped, { textTruncation: 'ENDING' })
    const fresh = resized(
      autoWidthText({ maxWidth: MAX_WIDTH * 3, maxLines: 1, textTruncation: 'ENDING' })
    )

    expect(truncated.height).toBeLessThan(wrapped.height)
    expect([truncated.width, truncated.height]).toEqual([fresh.width, fresh.height])
  })

  test('re-measures its width when its line cap changes', () => {
    const threeLines = resized(
      autoWidthText({ maxWidth: MAX_WIDTH * 3, textTruncation: 'ENDING', maxLines: 3 })
    )
    const oneLine = changed(threeLines, { maxLines: 1 })
    const fresh = resized(
      autoWidthText({ maxWidth: MAX_WIDTH * 3, textTruncation: 'ENDING', maxLines: 1 })
    )

    expect([oneLine.width, oneLine.height]).toEqual([fresh.width, fresh.height])
  })

  // Measured in Figma: auto-width text that reaches its max width takes all of it, wrapping or
  // truncated, rather than the width of its longest line.
  const FIGMA_TEXT = { text: 'The quick brown fox jumps over the lazy dog', fontSize: 12 }

  function lines(node: SceneNode): number {
    const layout = buildParagraph(renderer(), node)
    try {
      return layout.getLineMetrics().length
    } finally {
      layout.delete()
    }
  }

  test('takes its whole max width once its text reaches it, as Figma sizes it', () => {
    for (const [props, lineCount] of [
      [{}, 3],
      [{ textTruncation: 'ENDING', maxLines: 1 }, 1],
      [{ textTruncation: 'ENDING', maxLines: 2 }, 2]
    ] as const) {
      const node = resized(autoWidthText({ ...FIGMA_TEXT, maxWidth: 100, ...props }))
      expect(node.width).toBe(100)
      expect(lines(node)).toBe(lineCount)
    }
  })

  test('takes its whole max width in an auto layout frame that hugs it', () => {
    const graph = new SceneGraph()
    const frame = new FigmaAPI(graph).createFrame()
    frame.layoutMode = 'VERTICAL'
    frame.layoutSizingHorizontal = 'HUG'
    frame.layoutSizingVertical = 'HUG'
    const text = graph.createNode('TEXT', frame.id, {
      ...FIGMA_TEXT,
      fontFamily: 'Inter',
      lineHeight: null,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      textTruncation: 'ENDING',
      maxLines: 1,
      maxWidth: 100
    })
    withTextMeasurer(
      (node, maxWidth) => measureTextNode(renderer(), node, maxWidth),
      () => computeAllLayouts(graph, graph.getPages()[0].id)
    )

    expect(graph.getNode(text.id)?.width).toBe(100)
    expect(frame.width).toBe(100)
  })

  // Measured in Figma: ending truncation on auto-width text makes it one line, so a narrower
  // max width shortens that line rather than growing the box.
  test('stays one line when its max width shrinks under ending truncation without a line cap', () => {
    const wide = resized(
      autoWidthText({ ...FIGMA_TEXT, maxWidth: 400, textTruncation: 'ENDING', maxLines: null })
    )
    const narrow = changed(wide, { maxWidth: 100 })

    expect(lines(wide)).toBe(1)
    expect([narrow.width, narrow.height]).toEqual([100, wide.height])
    expect(lines(narrow)).toBe(1)
  })

  test('keeps the size it has while its fonts are not prepared', () => {
    const shown = resized(autoWidthText({ ...FIGMA_TEXT }))
    const pending = withTextMeasurer(
      () => null,
      () => textAutoResizeChanges(shown, { maxWidth: 100 })
    )

    expect(pending.width ?? shown.width).toBe(shown.width)
  })
})
