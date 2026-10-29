import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear()

/** A frame with three children, the frame selected; ids listed bottom to top. */
function createFrameWithChildren() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, { x: 100, y: 100, width: 300 })
    const children = ['Bottom', 'Middle', 'Top'].map(
      (name, index) =>
        store.graph.createNode('RECTANGLE', frame.id, {
          name,
          x: 20 + index * 60,
          y: 20,
          width: 40,
          height: 40
        }).id
    )
    store.select([frame.id])
    return { frameId: frame.id, children }
  })
}

function selectedIds() {
  return editor.page.evaluate(() => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])])
}

test('Enter, Shift+Enter, Tab, and Shift+Tab move through the layer tree', async () => {
  const { frameId, children } = await createFrameWithChildren()
  const [bottom, middle, top] = children

  await editor.page.keyboard.press('Enter')
  expect(new Set(await selectedIds())).toEqual(new Set(children))

  await editor.page.keyboard.press('Shift+Enter')
  expect(await selectedIds()).toEqual([frameId])

  await editor.page.evaluate((id) => window.openPencil?.getStore?.().select([id]), top)
  await editor.page.keyboard.press('Tab')
  expect(await selectedIds()).toEqual([middle])
  await editor.page.keyboard.press('Shift+Tab')
  expect(await selectedIds()).toEqual([top])
  await editor.page.keyboard.press('Shift+Tab')
  expect(await selectedIds()).toEqual([bottom])

  await editor.page.keyboard.press('Backslash')
  expect(await selectedIds()).toEqual([frameId])
})

test('Tab keeps moving focus while a panel control holds it', async () => {
  const { frameId } = await createFrameWithChildren()
  const button = editor.page.getByRole('button').first()
  await button.focus()

  await editor.page.keyboard.press('Tab')

  expect(await selectedIds()).toEqual([frameId])
  await expect(button).not.toBeFocused()
})

test('N and Shift+N zoom to the next and previous top-level frame', async () => {
  const frames = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    return [0, 600].map(
      (x) => store.graph.createNode('FRAME', pageId, { x, y: 0, width: 200, height: 200 }).id
    )
  })

  await editor.page.keyboard.press('n')
  expect(await selectedIds()).toEqual([frames[0]])
  await editor.page.keyboard.press('n')
  expect(await selectedIds()).toEqual([frames[1]])
  await editor.page.keyboard.press('Shift+N')
  expect(await selectedIds()).toEqual([frames[0]])
})

test('Page Down and Page Up switch pages', async () => {
  const [first, second] = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pages = store.graph.getPages()
    const firstPage = pages[0]
    const secondPage = pages[1] ?? store.graph.addPage('Second')
    return [firstPage.id, secondPage.id]
  })
  const currentPage = () =>
    editor.page.evaluate(() => window.openPencil?.getStore?.().state.currentPageId)

  await editor.page.keyboard.press('PageDown')
  await expect.poll(currentPage).toBe(second)
  await editor.page.keyboard.press('PageUp')
  await expect.poll(currentPage).toBe(first)
})

test('Shift+0 zooms to 100%', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (store) store.state.zoom = 2
  })

  await editor.page.keyboard.press('Shift+Digit0')

  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.().state.zoom)).toBe(1)
})
