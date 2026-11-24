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
