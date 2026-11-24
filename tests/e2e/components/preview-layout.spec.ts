import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('an overfull space-between row overflows in preview as it does on the canvas', async () => {
  const row = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const toggle = graph.createNode('COMPONENT', pageId, {
      name: 'Toggle',
      x: 500,
      y: 120,
      width: 107,
      height: 34
    })
    store.setBehaviour(toggle.id, {
      kind: 'button',
      booleans: {},
      texts: {},
      numbers: {},
      parts: {}
    })
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Row',
      x: 120,
      y: 120,
      width: 312,
      height: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'SPACE_BETWEEN',
      counterAxisAlign: 'CENTER',
      itemSpacing: 16
    })
    graph.createNode('RECTANGLE', frame.id, { name: 'Label', width: 217, height: 34 })
    graph.createInstance(toggle.id, frame.id, { name: 'Control' })
    store.runLayoutForNode(frame.id)
    const box = (name: string) => {
      const node = graph.getChildren(frame.id).find((child) => child.name === name)
      if (!node) throw new Error(`No ${name}`)
      return { x: node.x, width: node.width }
    }
    return { id: frame.id, boxes: { Label: box('Label'), Control: box('Control') } }
  })
  // 217 + 107 is wider than the row, so the control runs past its end.
  expect(row.boxes).toEqual({ Label: { x: 0, width: 217 }, Control: { x: 217, width: 107 } })
  await editor.canvas.waitForRender()
  await editor.page.keyboard.press('ControlOrMeta+Alt+Enter')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toBeVisible()

  const layer = (name: string) =>
    editor.page.locator(`[data-island="${row.id}"] [data-layer$="${name}"]`)
  for (const [name, box] of Object.entries(row.boxes)) {
    await expect
      .poll(() =>
        layer(name).evaluate((element: HTMLElement) => {
          const parent = element.parentElement
          if (!parent) throw new Error('No row')
          // Both rects carry the canvas zoom; their ratio to the layout width removes it.
          const at = element.getBoundingClientRect()
          const zoom = at.width / element.offsetWidth
          const x = (at.left - parent.getBoundingClientRect().left) / zoom
          return { x: Math.round(x), width: element.offsetWidth }
        })
      )
      .toEqual(box)
  }
})

test('a stroke left out of layout and an automatic line height measure in preview as on the canvas', async () => {
  const card = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const button = graph.createNode('COMPONENT', pageId, { x: 600, y: 120, width: 80, height: 30 })
    store.setBehaviour(button.id, {
      kind: 'button',
      booleans: {},
      texts: {},
      numbers: {},
      parts: {}
    })
    const black = { r: 0, g: 0, b: 0, a: 1 }
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 120,
      y: 120,
      width: 360,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      strokes: [
        { type: 'SOLID', color: black, opacity: 1, visible: true, weight: 1, align: 'INSIDE' }
      ]
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Fill',
      height: 20,
      layoutAlignSelf: 'STRETCH'
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Lines',
      text: 'One\nTwo',
      fontFamily: 'Inter',
      fontSize: 15,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    graph.createInstance(button.id, frame.id, { name: 'Control' })
    store.runLayoutForNode(frame.id)
    const height = (name: string) =>
      graph.getChildren(frame.id).find((child) => child.name === name)?.height
    const fill = graph.getChildren(frame.id).find((child) => child.name === 'Fill')
    return { id: frame.id, height: frame.height, fill: fill?.width, lines: height('Lines') }
  })
  expect(card.fill).toBe(312)
  await editor.canvas.waitForRender()
  await editor.page.keyboard.press('ControlOrMeta+Alt+Enter')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toBeVisible()

  const island = editor.page.locator(`[data-island="${card.id}"]`)
  const size = (selector: string, side: 'offsetWidth' | 'offsetHeight') =>
    island
      .locator(selector)
      .first()
      .evaluate((element: HTMLElement, key) => element[key], side)
  await expect.poll(() => size('[data-layer$="Fill"]', 'offsetWidth')).toBe(card.fill)
  await expect.poll(() => size('[data-layer$="Lines"]', 'offsetHeight')).toBe(card.lines)
  await expect.poll(() => size('[data-layer]', 'offsetHeight')).toBe(card.height)
})
