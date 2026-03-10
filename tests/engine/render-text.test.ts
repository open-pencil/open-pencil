import { describe, test, expect, mock } from 'bun:test'
import { renderText } from '../../packages/core/src/renderer/scene'
import type { SceneNode } from '../../packages/core/src/scene-graph'
import type { SkiaRenderer } from '../../packages/core/src/renderer/renderer'

function createMockCanvas() {
  return {
    drawParagraph: mock(() => {}),
    drawPicture: mock(() => {}),
    drawText: mock(() => {})
  }
}

function createMockParagraph() {
  return { delete: mock(() => {}) }
}

function createMockPicture() {
  return { delete: mock(() => {}) }
}

function createMockRenderer(overrides: Partial<Record<string, unknown>> = {}) {
  const paragraph = createMockParagraph()
  return {
    fontsLoaded: true,
    fontProvider: {},
    textFont: {},
    fillPaint: { getColor: () => new Float32Array([0, 0, 0, 1]) },
    ck: { MakePicture: mock(() => createMockPicture()) },
    DEFAULT_FONT_SIZE: 14,
    isNodeFontLoaded: mock(() => true),
    buildParagraph: mock(() => paragraph),
    _paragraph: paragraph,
    ...overrides
  } as unknown as SkiaRenderer & { _paragraph: ReturnType<typeof createMockParagraph> }
}

function textNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    text: 'Hello 你好',
    fontSize: 16,
    fontFamily: 'Arial',
    ...overrides
  } as SceneNode
}

describe('renderText', () => {
  test('uses buildParagraph when fonts are loaded and node font is available', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(r._paragraph.delete).toHaveBeenCalledTimes(1)
  })

  test('uses buildParagraph when fonts loaded but node font NOT available', () => {
    const r = createMockRenderer({ isNodeFontLoaded: mock(() => false) })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawText).not.toHaveBeenCalled()
  })

  test('prefers textPicture when node font is NOT available and textPicture exists', () => {
    const r = createMockRenderer({ isNodeFontLoaded: mock(() => false) })
    const canvas = createMockCanvas()
    const node = textNode({ textPicture: new Uint8Array([1, 2, 3]) })

    renderText(r, canvas as never, node)

    expect(canvas.drawPicture).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
    expect(canvas.drawText).not.toHaveBeenCalled()
  })

  test('uses buildParagraph even with textPicture when node font IS loaded', () => {
    const r = createMockRenderer({ isNodeFontLoaded: mock(() => true) })
    const canvas = createMockCanvas()
    const node = textNode({ textPicture: new Uint8Array([1, 2, 3]) })

    renderText(r, canvas as never, node)

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawPicture).not.toHaveBeenCalled()
  })

  test('never uses drawText when fonts are loaded (CJK safety)', () => {
    const r = createMockRenderer({ isNodeFontLoaded: mock(() => false) })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(canvas.drawText).not.toHaveBeenCalled()
  })

  test('falls back to drawText only when fonts are NOT loaded', () => {
    const r = createMockRenderer({ fontsLoaded: false, fontProvider: null })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(canvas.drawText).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
  })

  test('does nothing for empty text', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode({ text: '' }))

    expect(r.buildParagraph).not.toHaveBeenCalled()
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(canvas.drawPicture).not.toHaveBeenCalled()
  })
})
