import type { Page } from '@playwright/test'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-rulers')

function buildScene(page: Page): Promise<void> {
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
    store.graph.createNode('RECTANGLE', card.id, {
      name: 'Swatch',
      x: 16,
      y: 60,
      width: 80,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9, a: 1 }, visible: true, opacity: 1 }]
    })
    store.select([card.id])
    store.requestRender()
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

test.beforeEach(async () => {
  await editor.page.reload()
  await editor.canvas.waitForInit()
})

async function openCode(page: Page) {
  await page.getByTestId('properties-tab-code').click()
  await expect(codeLine(page, 'name="Swatch"')).toBeVisible()
}

function activeTags(page: Page) {
  return page.locator('[data-slot="code-editor"] .cm-layer-tag')
}

/** Moves focus out of the code, as clicking anywhere else in the app does. */
async function leaveCode(page: Page) {
  await page.getByTestId('code-panel-copy').focus()
}

function cardSize(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const card = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Card')
    return card ? `${card.width}x${card.height}` : null
  })
}

test('the element around the cursor marks its tags and its layer', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)

  await codeLine(editor.page, 'name="Swatch"').click({ position: { x: 24, y: 8 } })
  await expect(activeTags(editor.page)).toHaveText(['Rectangle'])
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Swatch')

  await codeLine(editor.page, 'name="Fine print"').click({ position: { x: 24, y: 8 } })
  // Both the opening and the closing tag name are marked.
  await expect(activeTags(editor.page)).toHaveText(['Text', 'Text'])
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Fine print')

  await leaveCode(editor.page)
  await expect(activeTags(editor.page)).toHaveCount(0)
  await expect.poll(() => hoveredLayer(editor.page)).toBeNull()
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

  // The preview replaced the layers; the cursor must resolve to a layer that still exists.
  await codeLine(editor.page, 'name="Swatch"').click({ position: { x: 24, y: 8 } })
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Swatch')
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-lintRange-warning')).toHaveText(
    'size={10}'
  )
})

test('canvas edits after a code edit flow back into the code and undo in order', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  await codeLine(editor.page, 'name="Card"').click()
  await editor.page.keyboard.press('End')
  await editor.page.keyboard.type(' ')
  await expect(editor.page.getByTestId('code-panel-status')).toHaveText('Updated live')

  await leaveCode(editor.page)
  await expect(editor.page.getByTestId('code-panel-status')).toHaveText('Up to date')
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const card = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Card')
    if (!store || !card) throw new Error('Card not found')
    store.updateNodeWithUndo(card.id, { width: 400 }, 'Resize')
  })
  await expect(codeLine(editor.page, 'name="Card"')).toContainText('w={400}')

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => cardSize(editor.page)).toBe('320x160')
  await expect(codeLine(editor.page, 'name="Card"')).toContainText('w={320}')
})
