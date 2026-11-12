import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('places and truncates lines of mixed sizes as Figma does', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const big = (start: number, length: number) => ({ start, length, style: { fontSize: 36 } })
    const wrapping = 'Small words LARGE then wraps onto more lines'
    const truncationFill = [
      {
        type: 'SOLID' as const,
        color: { r: 0.86, g: 0.91, b: 0.98, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
    for (const [name, y, height] of [
      ['Two small lines fit', 40, 34],
      ['Tall second line overflows', 220, 70]
    ] as const) {
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name,
        x: 732,
        y,
        width: 150,
        height,
        fills: truncationFill
      })
    }
    const texts = [
      { x: 40, y: 40, text: wrapping, styleRuns: [big(12, 5)] },
      { x: 280, y: 40, text: wrapping, styleRuns: [big(12, 5)], textAlignHorizontal: 'CENTER' },
      {
        x: 520,
        y: 40,
        text: wrapping,
        styleRuns: [big(12, 5)],
        textAlignHorizontal: 'JUSTIFIED'
      },
      {
        x: 40,
        y: 220,
        text: 'one\ntwo with a tall line\nthree',
        styleRuns: [{ start: 4, length: 20, style: { lineHeight: { value: 48, unit: 'PIXELS' } } }]
      },
      {
        x: 280,
        y: 220,
        text: 'Small LARGE\nunder a fixed line height',
        lineHeight: { value: 24, unit: 'PIXELS' },
        styleRuns: [big(6, 5)]
      },
      {
        x: 520,
        y: 220,
        text: 'First item\nSecond BIG item wraps\nThird',
        styleRuns: [big(18, 3)],
        paragraphSpacing: 8,
        textDecoration: 'UNDERLINE',
        textParagraphs: [
          { listType: 'UNORDERED', indentation: 1 },
          { listType: 'UNORDERED', indentation: 1 },
          { listType: 'UNORDERED', indentation: 1 }
        ]
      }
    ] as const
    for (const props of texts) {
      store.graph.createNode('TEXT', store.state.currentPageId, {
        width: 200,
        height: 160,
        fontFamily: 'Inter',
        fontSize: 18,
        lineHeight: null,
        textAutoResize: 'HEIGHT',
        ...props,
        styleRuns: [...props.styleRuns],
        textParagraphs: 'textParagraphs' in props ? [...props.textParagraphs] : []
      })
    }
    store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Small mixed-size lines fit the fixed height',
      x: 740,
      y: 40,
      width: 134,
      height: 34,
      text: 'small\nsmall\nsmall',
      fontSize: 40,
      textAutoResize: 'NONE',
      textTruncation: 'ENDING',
      styleRuns: [{ start: 0, length: 17, style: { fontSize: 12 } }]
    })
    store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Tall mixed-size line exceeds the fixed height',
      x: 740,
      y: 220,
      width: 134,
      height: 70,
      text: 'small\nLARGE\nsmall',
      fontSize: 16,
      textAutoResize: 'NONE',
      textTruncation: 'ENDING',
      styleRuns: [{ start: 6, length: 5, style: { fontSize: 40 } }]
    })
    store.requestRender()
  })
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store?.graph.getChildren(store.state.currentPageId).filter((node) => node.type === 'TEXT')
        .length === 8
    )
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('text-lines.png')
})

test('steps lines by a fractional line height as Figma does', async () => {
  const heights = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const tint = {
      type: 'SOLID' as const,
      color: { r: 0.86, g: 0.91, b: 0.98, a: 1 },
      opacity: 1,
      visible: true
    }
    const text = Array.from({ length: 8 }, (_, index) => `Line ${index + 1}`).join('\n')
    // Each tint is as tall as Figma desktop 126 makes the text: eight exact pixel steps rounded
    // up, or eight whole-pixel steps for a percent line height.
    const samples = [
      { x: 40, fontSize: 15, lineHeight: { value: 22.5, unit: 'PIXELS' as const }, height: 180 },
      { x: 200, fontSize: 23, lineHeight: { value: 30.6, unit: 'PIXELS' as const }, height: 245 },
      { x: 360, fontSize: 13, lineHeight: { value: 110, unit: 'PERCENT' as const }, height: 112 }
    ]
    const texts: string[] = []
    for (const sample of samples) {
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Figma height',
        x: sample.x,
        y: 40,
        width: 120,
        height: sample.height,
        fills: [tint]
      })
      const node = store.graph.createNode('TEXT', store.state.currentPageId, {
        x: sample.x,
        y: 40,
        width: 120,
        height: 100,
        text,
        fontFamily: 'Inter',
        fontSize: sample.fontSize,
        lineHeight: sample.lineHeight,
        textAutoResize: 'HEIGHT'
      })
      texts.push(node.id)
    }
    // Texts take their height once laid out in their fonts.
    await store.loadFontsForNodes(texts)
    for (const id of texts) store.updateNode(id, { textAutoResize: 'HEIGHT' })
    store.requestRender()
    return texts.map((id) => store.graph.getNode(id)?.height)
  })
  expect(heights).toEqual([180, 245, 112])
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'fractional-line-heights.png'
  )
})

test('sets lines on one baseline at a line height of zero, as Figma does', async () => {
  const heights = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    // Figma desktop 126 sets every line on one baseline at 0 px and at 2% of 14 px, which rounds
    // to none, and makes the text 0 px tall; at 0.3 px it steps them by 0.3 px and 1 px tall.
    const samples = [
      { x: 40, lineHeight: { value: 0, unit: 'PIXELS' as const } },
      { x: 160, lineHeight: { value: 2, unit: 'PERCENT' as const } },
      { x: 280, lineHeight: { value: 0.3, unit: 'PIXELS' as const } }
    ]
    // Each text sits in a white card, which draws its lines though the text has no height.
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      x: 20,
      y: 20,
      width: 380,
      height: 80,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    const texts: string[] = []
    for (const sample of samples) {
      const node = store.graph.createNode('TEXT', card.id, {
        x: sample.x,
        y: 40,
        width: 100,
        height: 40,
        text: 'Line one\nLine two\nLine three',
        fontFamily: 'Inter',
        fontSize: 14,
        lineHeight: sample.lineHeight,
        textAutoResize: 'HEIGHT'
      })
      texts.push(node.id)
    }
    await store.loadFontsForNodes(texts)
    for (const id of texts) store.updateNode(id, { textAutoResize: 'HEIGHT' })
    store.requestRender()
    return texts.map((id) => store.graph.getNode(id)?.height)
  })
  expect(heights).toEqual([0, 0, 1])
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('zero-line-heights.png')
})

test('draws a text 0 px tall placed on the page, by its glyphs', async () => {
  const heights = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    // With nothing around it, the text's own bounds decide what the canvas draws: its glyphs
    // reach past its box, which has no height.
    const texts: string[] = []
    for (const [x, text] of [
      [40, 'Line one\nLine two\nLine three'],
      [160, 'Hgy']
    ] as const) {
      const node = store.graph.createNode('TEXT', store.state.currentPageId, {
        x,
        y: 60,
        width: 100,
        height: 40,
        text,
        fontFamily: 'Inter',
        fontSize: 14,
        lineHeight: { value: 0, unit: 'PIXELS' },
        textAutoResize: 'HEIGHT'
      })
      texts.push(node.id)
    }
    await store.loadFontsForNodes(texts)
    for (const id of texts) store.updateNode(id, { textAutoResize: 'HEIGHT' })
    store.requestRender()
    return texts.map((id) => store.graph.getNode(id)?.height)
  })
  expect(heights).toEqual([0, 0])
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'zero-height-text-on-page.png'
  )
})
