import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { measureTextNode } from '#core/canvas/text'
import { buildParagraph } from '#core/canvas/text/layout/build'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { getCanvasKit } from '#core/canvaskit'
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
})
