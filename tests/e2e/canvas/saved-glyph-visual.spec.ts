import type { Fill, StyleRun } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import styledGlyphs from '#tests/fixtures/styled-saved-glyphs.json' with { type: 'json' }

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('saved glyphs remain authoritative with an available font and invalidate on edit', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const bytes = new Uint8Array(37)
    const view = new DataView(bytes.buffer)
    for (const [index, [command, x, y]] of [
      [1, 0, 0],
      [2, 1, 0],
      [2, 1, 1],
      [2, 0, 1]
    ].entries()) {
      bytes[index * 9] = command
      view.setFloat32(index * 9 + 1, x, true)
      view.setFloat32(index * 9 + 5, y, true)
    }
    for (const [index, action] of ['unchanged', 'paint', 'text', 'width', 'runs'].entries()) {
      const node = store.graph.createNode('TEXT', store.state.currentPageId, {
        x: 40 + index * 150,
        y: 100,
        width: 140,
        height: 60,
        text: 'Inter',
        fontFamily: 'Inter',
        fontSize: 32,
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.8, a: 1 }, opacity: 1, visible: true }
        ],
        derivedTextGlyphs: [{ commandsBlob: bytes.slice(), x: 4, y: 40, fontSize: 32 }]
      })
      if (action === 'paint')
        store.graph.updateNode(node.id, {
          fills: [
            { type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.1, a: 1 }, opacity: 1, visible: true }
          ]
        })
      if (action === 'runs') {
        store.graph.updateNode(node.id, {
          styleRuns: [
            {
              start: 0,
              length: 2,
              style: {
                fills: [
                  {
                    type: 'SOLID',
                    color: { r: 0.1, g: 0.7, b: 0.2, a: 1 },
                    opacity: 1,
                    visible: true
                  }
                ]
              }
            }
          ],
          derivedTextGlyphs: [
            { commandsBlob: bytes.slice(), x: 4, y: 40, fontSize: 24, firstCharacter: 0 },
            { commandsBlob: bytes.slice(), x: 40, y: 40, fontSize: 24, firstCharacter: 2 }
          ]
        })
      }
      if (action === 'text') store.graph.updateNode(node.id, { text: 'Edited' })
      if (action === 'width') store.graph.updateNode(node.id, { width: 100 })
    }
    store.requestRender()
  })
  await editor.page.evaluate((fixture) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.graph.createNode('TEXT', store.state.currentPageId, {
      ...fixture,
      x: 40,
      y: 220,
      fills: fixture.fills as Fill[],
      styleRuns: fixture.styleRuns as StyleRun[],
      derivedTextGlyphs: fixture.derivedTextGlyphs.map((glyph) => ({
        ...glyph,
        commandsBlob: new Uint8Array(glyph.commandsBlob)
      }))
    })
    store.requestRender()
  }, styledGlyphs)
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
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('saved-glyph-authority.png')
})

/**
 * Figma saves an emoji as a placeholder square 1 em wide, from 0.07 em below the baseline, with
 * the emoji's code points, and draws the emoji's image over it in its own colours: the text's
 * fill, here a half-transparent red or a gradient, colours the letters and never the emoji. A
 * gradient spans the layer as on a shape. Measured in Figma desktop; the square was drawn in the
 * fill colour before, and gradient text lost its emoji and stretched its gradient by the font size.
 */
test('saved emoji glyphs draw the emoji, not their placeholder, in their own colours', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const outline = (points: [number, number, number][]) => {
      const bytes = new Uint8Array(points.length * 9 + 1)
      const view = new DataView(bytes.buffer)
      for (const [index, [command, x, y]] of points.entries()) {
        bytes[index * 9] = command
        view.setFloat32(index * 9 + 1, x, true)
        view.setFloat32(index * 9 + 5, y, true)
      }
      return bytes
    }
    const letter = outline([
      [1, 0.1, 0],
      [2, 0.6, 0],
      [2, 0.6, 0.7],
      [2, 0.1, 0.7]
    ])
    const placeholder = outline([
      [1, 0, -0.07],
      [2, 1, -0.07],
      [2, 1, 0.93],
      [2, 0, 0.93]
    ])
    store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 40,
      y: 100,
      width: 300,
      height: 80,
      text: 'H🖥️H👍🏽',
      fontFamily: 'Inter',
      fontSize: 64,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }],
      derivedTextGlyphs: [
        { commandsBlob: letter.slice(), x: 0, y: 62, fontSize: 64, firstCharacter: 0, advance: 47 },
        {
          commandsBlob: placeholder.slice(),
          x: 47,
          y: 62,
          fontSize: 64,
          firstCharacter: 1,
          advance: 64,
          emojiCodePoints: [0x1f5a5, 0xfe0f]
        },
        {
          commandsBlob: letter.slice(),
          x: 111,
          y: 62,
          fontSize: 64,
          firstCharacter: 4,
          advance: 47
        },
        {
          commandsBlob: placeholder.slice(),
          x: 158,
          y: 62,
          fontSize: 64,
          firstCharacter: 5,
          advance: 64,
          emojiCodePoints: [0x1f44d, 0x1f3fd]
        }
      ]
    })
    store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 40,
      y: 200,
      width: 240,
      height: 80,
      text: 'HH🖥️',
      fontFamily: 'Inter',
      fontSize: 64,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 0.49, g: 0.23, b: 0.93, a: 1 } },
            { position: 1, color: { r: 0.98, g: 0.45, b: 0.09, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ],
      derivedTextGlyphs: [
        { commandsBlob: letter.slice(), x: 0, y: 62, fontSize: 64, firstCharacter: 0, advance: 47 },
        {
          commandsBlob: letter.slice(),
          x: 64,
          y: 62,
          fontSize: 64,
          firstCharacter: 1,
          advance: 47
        },
        {
          commandsBlob: placeholder.slice(),
          x: 128,
          y: 62,
          fontSize: 64,
          firstCharacter: 2,
          advance: 64,
          emojiCodePoints: [0x1f5a5, 0xfe0f]
        }
      ]
    })
    store.requestRender()
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  // A missing emoji covers less than the default 1% of the region, so allow only edge noise.
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('saved-emoji-glyphs.png', {
    maxDiffPixels: 500
  })
})

/**
 * Emoji typed in OpenPencil have no saved glyphs: the layout gives each Figma's 1 em square
 * through the emoji metrics font, and the emoji's image is drawn there in its own colours.
 * A character a text font has, such as ©, stays text.
 */
test('typed emoji take a 1 em square and draw their image', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 40,
      y: 100,
      width: 600,
      height: 80,
      text: 'Hi 😀👨‍👩‍👧‍👦🇺🇸 © ok',
      fontFamily: 'Inter',
      fontSize: 48,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }]
    })
    store.requestRender()
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  // A missing emoji covers less than the default 1% of the region, so allow only edge noise.
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('typed-emoji.png', {
    maxDiffPixels: 500
  })
})

/**
 * Figma draws a keycap as the text font's character with Noto Sans Symbols' keycap frame after
 * it, in the colour of its text, a style run's included; the whole text used to disappear, as
 * Inter has no keycap mark.
 */
test('typed keycaps draw their character in a keycap frame', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 40,
      y: 100,
      width: 600,
      height: 80,
      text: 'Keys 1⃣ #⃣ ok',
      fontFamily: 'Inter',
      fontSize: 48,
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.2, a: 1 }, opacity: 1, visible: true }
      ],
      styleRuns: [
        {
          start: 8,
          length: 2,
          style: {
            fills: [
              { type: 'SOLID', color: { r: 0.9, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }
            ]
          }
        }
      ]
    })
    // Upper-cased, ß shows as SS: the keycap's run is found by its source index all the same.
    store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 40,
      y: 200,
      width: 600,
      height: 80,
      text: '\u00df 1\u20e3',
      textCase: 'UPPER',
      fontFamily: 'Inter',
      fontSize: 48,
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.2, a: 1 }, opacity: 1, visible: true }
      ],
      styleRuns: [
        {
          start: 2,
          length: 2,
          style: {
            fills: [
              { type: 'SOLID', color: { r: 0.9, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }
            ]
          }
        }
      ]
    })
    store.requestRender()
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  // Letters a few hundred pixels wide stand out from edge noise; the default 1% would not.
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('typed-keycap.png', {
    maxDiffPixels: 500
  })
})
