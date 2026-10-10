import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('editing section labels preserve dark and light label presentation', async () => {
  const sections = [
    { id: 'dark-section', y: 160, color: { r: 0.37, g: 0.37, b: 0.37, a: 1 } },
    { id: 'light-section', y: 400, color: { r: 0.92, g: 0.82, b: 0.38, a: 1 } }
  ] as const
  await editor.page.evaluate((items) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const item of items) {
      store.graph.createNode('SECTION', store.state.currentPageId, {
        id: item.id,
        name: 'Components',
        x: 120,
        y: item.y,
        width: 280,
        height: 180,
        fills: [{ type: 'SOLID', color: item.color, visible: true, opacity: 1 }]
      })
    }
    store.requestRender()
  }, sections)
  await editor.canvas.waitForRender()

  const canvas = editor.page.getByTestId('canvas-element')
  const input = editor.page.getByRole('textbox', { name: 'Layer name' })
  const expected = [
    { y: 142, background: 'rgb(94, 94, 94)', foreground: 'rgb(255, 255, 255)' },
    { y: 382, background: 'rgb(235, 209, 97)', foreground: 'rgb(0, 0, 0)' }
  ]

  for (const item of expected) {
    await canvas.dblclick({ position: { x: 128, y: item.y } })
    await expect(input).toBeVisible()
    const editorPill = input.locator('xpath=../..')
    await expect(editorPill).toHaveCSS('height', '24px')
    await expect(editorPill).toHaveCSS('background-color', item.background)
    await expect(input).toHaveCSS('color', item.foreground)
    // The canvas title's own type, so the name does not change size when the field opens.
    await expect(input).toHaveCSS('font-size', '11px')
    await expect(input).toHaveCSS('font-weight', '600')
    await input.press('Escape')
    await expect(input).toBeHidden()
  }
})

test('double-clicking a section title renames it inline', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    store.graph.createNode('SECTION', pageId, {
      id: 'section-inline-rename',
      name: 'Components',
      x: 120,
      y: 160,
      width: 280,
      height: 180,
      fills: [
        { type: 'SOLID', color: { r: 0.37, g: 0.37, b: 0.37, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.requestRender()
  })
  await editor.canvas.waitForRender()

  const canvas = editor.page.getByTestId('canvas-element')
  await canvas.dblclick({ position: { x: 128, y: 142 } })
  const input = editor.page.getByRole('textbox', { name: 'Layer name' })
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('Components')

  await input.fill('Primitives')
  await input.press('Enter')

  await expect(input).toBeHidden()
  await expect
    .poll(() =>
      editor.page.evaluate(
        () => window.openPencil?.getStore?.().graph.getNode('section-inline-rename')?.name
      )
    )
    .toBe('Primitives')
})

// Figma desktop 126: the name above a frame or component renames in place and stays selected.
test('double-clicking a frame or component name renames it inline and keeps it selected', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const white = [
      { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }
    ]
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 120,
      y: 160,
      width: 200,
      height: 150,
      fills: white
    })
    const component = store.graph.createNode('COMPONENT', pageId, {
      name: 'Button',
      x: 120,
      y: 400,
      width: 160,
      height: 100,
      fills: white
    })
    store.clearSelection()
    store.requestRender()
    return { frame: frame.id, component: component.id }
  })
  await editor.canvas.waitForRender()

  const canvas = editor.page.getByTestId('canvas-element')
  const input = editor.page.getByRole('textbox', { name: 'Layer name' })
  for (const [id, point, from, to] of [
    [ids.frame, { x: 126, y: 147 }, 'Card', 'Pricing card'],
    [ids.component, { x: 144, y: 388 }, 'Button', 'Primary button']
  ] as const) {
    await canvas.dblclick({ position: point })
    await expect(input).toBeVisible()
    await expect(input).toHaveValue(from)
    await expect(input.locator('xpath=../..')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await input.fill(to)
    await input.press('Enter')
    await expect(input).toBeHidden()
    await expect
      .poll(() =>
        editor.page.evaluate((nodeId) => {
          const store = window.openPencil?.getStore?.()
          return {
            name: store?.graph.getNode(nodeId)?.name,
            selected: [...(store?.state.selectedIds ?? [])]
          }
        }, id)
      )
      .toEqual({ name: to, selected: [id] })
  }
  editor.canvas.assertNoErrors()
})
