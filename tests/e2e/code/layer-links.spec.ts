import type { Page } from '@playwright/test'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-rulers')

interface Scene {
  cardId: string
  swatchId: string
}

function buildScene(page: Page): Promise<Scene> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 320,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('TEXT', card.id, {
      name: 'Fine print',
      x: 16,
      y: 16,
      width: 200,
      height: 14,
      text: 'Terms apply',
      fontSize: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    const swatch = store.graph.createNode('RECTANGLE', card.id, {
      name: 'Swatch',
      x: 16,
      y: 60,
      width: 80,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9, a: 1 }, visible: true, opacity: 1 }]
    })
    store.select([card.id])
    store.requestRender()
    return { cardId: card.id, swatchId: swatch.id }
  })
}

function codeLine(page: Page, text: string) {
  return page.locator('[data-slot="code-editor"] .cm-line', { hasText: text })
}

function hoveredLayer(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = store?.state.hoveredNodeId
    return id ? (store.graph.getNode(id)?.name ?? null) : null
  })
}

function viewport(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      panX: store.state.panX,
      panY: store.state.panY,
      selected: [...store.state.selectedIds]
    }
  })
}

test.beforeEach(async () => {
  await editor.page.reload()
  await editor.canvas.waitForInit()
})

async function openCode(page: Page) {
  await page.getByTestId('properties-tab-code').click()
  await expect(codeLine(page, 'name="Swatch"')).toBeVisible()
}

test('hovering an element in generated code highlights its layer', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)

  await codeLine(editor.page, 'name="Swatch"').hover({ position: { x: 24, y: 8 } })
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Swatch')

  await editor.page.getByTestId('code-panel-copy').hover()
  await expect.poll(() => hoveredLayer(editor.page)).toBeNull()
})

test('⌘-click brings a layer into view without changing the selection', async () => {
  const scene = await buildScene(editor.page)
  await openCode(editor.page)
  await editor.page.evaluate(() => window.openPencil?.getStore?.().pan(-2000, -1500))
  const before = await viewport(editor.page)

  await codeLine(editor.page, 'name="Swatch"').click({
    position: { x: 24, y: 8 },
    modifiers: ['ControlOrMeta']
  })

  await expect.poll(async () => (await viewport(editor.page)).panX).not.toBe(before.panX)
  expect((await viewport(editor.page)).selected).toEqual([scene.cardId])
})

test('design issues are underlined on the property that causes them', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)

  const warning = editor.page.locator('[data-slot="code-editor"] .cm-lintRange-warning')
  await expect(warning).toHaveText('size={10}')
})

test('links follow the code after a live edit', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)

  await codeLine(editor.page, 'name="Card"').click()
  await editor.page.keyboard.press('End')
  await editor.page.keyboard.type(' ')
  await expect(editor.page.getByTestId('code-panel-status')).toHaveText('Updated live')

  // The preview replaced the layers; hovering must resolve to a layer that still exists.
  await codeLine(editor.page, 'name="Swatch"').hover({ position: { x: 24, y: 8 } })
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Swatch')
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-lintRange-warning')).toHaveText(
    'size={10}'
  )
})
