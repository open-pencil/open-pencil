import type { Fill, StyleRun, TextParagraphStyle } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import listGlyphs from '#tests/fixtures/list-saved-glyphs.json' with { type: 'json' }

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('draws list markers, indents, and spacing as Figma lays them out', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const item = (listType: 'ORDERED' | 'UNORDERED', indentation = 1) => ({
      listType,
      indentation
    })
    const plain = { listType: 'NONE' as const, indentation: 0 }
    const texts = [
      {
        x: 40,
        y: 40,
        width: 200,
        text: 'Follow us on:\nTwitter\nNested once\nNested twice\nDiscord',
        textParagraphs: [
          plain,
          item('UNORDERED'),
          item('UNORDERED', 2),
          item('UNORDERED', 3),
          item('UNORDERED')
        ]
      },
      {
        x: 280,
        y: 40,
        width: 160,
        text: Array.from({ length: 11 }, (_, index) => `Step ${index + 1}`).join('\n'),
        textParagraphs: Array.from({ length: 11 }, (_, index) =>
          item('ORDERED', index === 3 || index === 4 ? 2 : 1)
        )
      },
      {
        x: 480,
        y: 40,
        width: 180,
        text: 'An item long enough to wrap onto more lines\nShort\nA paragraph after',
        textParagraphs: [item('UNORDERED'), item('UNORDERED'), plain],
        listSpacing: 8,
        paragraphSpacing: 16
      },
      {
        x: 480,
        y: 220,
        width: 180,
        text: 'Hanging\nmarkers',
        textParagraphs: [item('UNORDERED'), item('UNORDERED')],
        hangingList: true
      },
      {
        x: 700,
        y: 40,
        width: 160,
        text: 'Centred\nlist',
        textAlignHorizontal: 'CENTER' as const,
        textParagraphs: [item('ORDERED'), item('ORDERED')]
      }
    ]
    for (const props of texts) {
      store.graph.createNode('TEXT', store.state.currentPageId, {
        height: 260,
        fontFamily: 'Inter',
        fontSize: 16,
        textAutoResize: 'HEIGHT',
        ...props
      })
    }
    store.requestRender()
  })
  // Glyphs Figma saved for a list whose first character is larger and red: its markers take
  // that style, and the canvas draws them as saved.
  await editor.page.evaluate((fixture) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.graph.createNode('TEXT', store.state.currentPageId, {
      ...fixture,
      x: 700,
      y: 160,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: fixture.fills as Fill[],
      styleRuns: fixture.styleRuns as StyleRun[],
      textParagraphs: fixture.textParagraphs as TextParagraphStyle[],
      derivedTextGlyphs: fixture.derivedTextGlyphs.map((glyph) => ({
        ...glyph,
        commandsBlob: new Uint8Array(glyph.commandsBlob)
      }))
    })
    store.requestRender()
  }, listGlyphs)
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store?.graph.getChildren(store.state.currentPageId).filter((node) => node.type === 'TEXT')
        .length === 6
    )
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('text-lists.png')
})
