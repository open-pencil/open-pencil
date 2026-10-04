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

/** The layer under the pointer on the canvas, which is separate from the code's layer. */
function hoveredLayer(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = store?.state.hoveredNodeId
    return id ? (store.graph.getNode(id)?.name ?? null) : null
  })
}

function focusedLayer(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = store?.state.codeFocusNodeId
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
  await expect.poll(() => focusedLayer(editor.page)).toBe('Swatch')

  await codeLine(editor.page, 'name="Fine print"').click({ position: { x: 24, y: 8 } })
  // Both the opening and the closing tag name are marked.
  await expect(activeTags(editor.page)).toHaveText(['Text', 'Text'])
  await expect.poll(() => focusedLayer(editor.page)).toBe('Fine print')

  // Canvas hover is a separate mark: hovering another layer keeps the code's layer marked.
  await editor.canvas.hover(130, 170)
  await expect.poll(() => hoveredLayer(editor.page)).toBe('Swatch')
  expect(await focusedLayer(editor.page)).toBe('Fine print')
  await editor.canvas.waitForRender()
  const canvas = await editor.canvas.canvas.boundingBox()
  if (!canvas) throw new Error('Canvas has no bounding box')
  expect(
    await editor.page.screenshot({
      clip: { x: canvas.x + 60, y: canvas.y + 60, width: 360, height: 200 }
    })
  ).toMatchSnapshot('code-focus-and-hover.png')

  await leaveCode(editor.page)
  await expect(activeTags(editor.page)).toHaveCount(0)
  await expect.poll(() => focusedLayer(editor.page)).toBeNull()
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
  await expect.poll(() => focusedLayer(editor.page)).toBe('Swatch')
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-lintRange-warning')).toHaveText(
    'size={10}'
  )
})

/** Runs a canvas edit through the store, as a Design panel or canvas gesture commits it. */
function editLayer(page: Page, name: string, changes: Record<string, unknown>) {
  return page.evaluate(
    ({ name, changes }) => {
      const store = window.openPencil?.getStore?.()
      const node = [...(store?.graph.getAllNodes() ?? [])].find((n) => n.name === name)
      if (!store || !node) throw new Error(`${name} not found`)
      store.updateNodeWithUndo(node.id, changes, 'Edit')
    },
    { name, changes }
  )
}

function layerId(page: Page, name: string) {
  return page.evaluate((name) => {
    const store = window.openPencil?.getStore?.()
    return [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === name)?.id ?? null
  }, name)
}

function codeText(page: Page) {
  return page.locator('[data-slot="code-editor"] .cm-content').innerText()
}

/** Writes like a person: a comment above the card and an expression for the swatch width. */
async function personalizeCode(page: Page) {
  await codeLine(page, 'name="Card"').click()
  await page.keyboard.press('ControlOrMeta+Home')
  await page.keyboard.type('// Pricing card')
  await page.keyboard.press('Enter')
  await codeLine(page, 'name="Swatch"').locator('span', { hasText: /^80$/ }).dblclick()
  await page.keyboard.type('40 * 2')
  await expect(page.getByTestId('code-panel-status')).toHaveText('Updated live')
}

test('code edits update the layers in place', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  const swatchId = await layerId(editor.page, 'Swatch')

  await codeLine(editor.page, 'name="Swatch"').locator('span', { hasText: /^80$/ }).dblclick()
  await editor.page.keyboard.type('120')

  await expect
    .poll(() =>
      editor.page.evaluate(
        (id) => (id ? window.openPencil?.getStore?.().graph.getNode(id)?.width : null),
        swatchId
      )
    )
    .toBe(120)
})

test('canvas edits patch code a person wrote and keep the rest as written', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  await personalizeCode(editor.page)

  await editLayer(editor.page, 'Card', { width: 400 })
  await editLayer(editor.page, 'Swatch', { width: 100 })

  await expect(codeLine(editor.page, 'name="Card"')).toContainText('w={400}')
  const text = await codeText(editor.page)
  expect(text).toContain('// Pricing card')
  // The width the person wrote as an expression is theirs; the canvas does not overwrite it,
  // and the code says the canvas now differs.
  expect(text).toContain('w={40 * 2}')
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-lintRange-info')).toHaveText(
    'w={40 * 2}'
  )
})

test('layers added or deleted on the canvas are written into the code', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  await personalizeCode(editor.page)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const card = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Card')
    const note = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Fine print')
    if (!store || !card || !note) throw new Error('scene not found')
    store.graph.createNode('ELLIPSE', card.id, {
      name: 'Dot',
      x: 200,
      y: 60,
      width: 24,
      height: 24
    })
    store.graph.deleteNode(note.id)
    store.requestRender()
  })

  await expect(codeLine(editor.page, 'name="Dot"')).toBeVisible()
  await expect(codeLine(editor.page, 'name="Fine print"')).toHaveCount(0)
  expect(await codeText(editor.page)).toContain('// Pricing card')

  await codeLine(editor.page, 'name="Dot"').click({ position: { x: 24, y: 8 } })
  await expect.poll(() => focusedLayer(editor.page)).toBe('Dot')
})

test('undo reverts a code edit on the canvas and in the code', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  await codeLine(editor.page, 'name="Card"').locator('span', { hasText: /^320$/ }).dblclick()
  await editor.page.keyboard.type('360')
  await expect.poll(() => cardSize(editor.page)).toBe('360x160')

  await editLayer(editor.page, 'Card', { height: 200 })
  await expect(codeLine(editor.page, 'name="Card"')).toContainText('h={200}')

  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  await expect(codeLine(editor.page, 'name="Card"')).toContainText('h={160}')
  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  await expect.poll(() => cardSize(editor.page)).toBe('320x160')
  await expect(codeLine(editor.page, 'name="Card"')).toContainText('w={320}')
})

test('a value written under another name is patched under that name', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  // The person renames `w` to `width`, which Design JSX also accepts.
  await codeLine(editor.page, 'name="Card"').locator('span', { hasText: /^w$/ }).dblclick()
  await editor.page.keyboard.type('width')
  await expect(editor.page.getByTestId('code-panel-status')).toHaveText('Updated live')

  await editLayer(editor.page, 'Card', { width: 400 })

  await expect(codeLine(editor.page, 'name="Card"')).toContainText('width={400}')
  await expect(codeLine(editor.page, 'name="Card"')).not.toContainText(' w={')
})

test('reordering layers on the canvas moves their elements and keeps them linked', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  await personalizeCode(editor.page)
  // The cursor sits in the swatch element, which the reorder is about to move.
  await codeLine(editor.page, 'name="Swatch"').click({ position: { x: 24, y: 8 } })

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const swatch = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Swatch')
    if (!store || !swatch?.parentId) throw new Error('Swatch not found')
    store.graph.reorderChild(swatch.id, swatch.parentId, 0)
    store.requestRender()
  })

  await expect
    .poll(async () => {
      const text = await codeText(editor.page)
      return text.indexOf('name="Swatch"') < text.indexOf('name="Fine print"')
    })
    .toBe(true)
  const text = await codeText(editor.page)
  expect(text).toContain('// Pricing card')
  expect(text).toContain('w={40 * 2}')

  // The cursor moved with its element and still marks the swatch.
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-activeLine')).toContainText(
    'name="Swatch"'
  )
  await expect.poll(() => focusedLayer(editor.page)).toBe('Swatch')
})

test('a value written inside style is patched there in its own format', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  const code = (await codeText(editor.page))
    .replace(/(name="Card"[^>]*?) w=\{320\}/, "$1 style={{ width: '320px' }}")
    .replace(/(name="Card"[^>]*?) h=\{160\}/, '$1 h={170}')
  await codeLine(editor.page, 'name="Card"').click()
  await editor.page.keyboard.press('ControlOrMeta+a')
  await editor.page.keyboard.insertText(code)
  // Replacing all the code links it again once its preview applies, shown by the new height.
  await expect.poll(() => cardSize(editor.page)).toBe('320x170')

  await editLayer(editor.page, 'Card', { width: 400 })

  await expect(codeLine(editor.page, 'name="Card"')).toContainText("style={{ width: '400px' }}")
  await expect(codeLine(editor.page, 'name="Card"')).not.toContainText(' w={')
})

test('a reorder that cannot move the code still writes layers added with it', async () => {
  await buildScene(editor.page)
  await openCode(editor.page)
  // Two children on one line cannot be moved as blocks of their own.
  const code = (await codeText(editor.page))
    .replace(/<\/Text>\n\s*<Rectangle/, '</Text> <Rectangle')
    .replace(/(name="Card"[^>]*?) h=\{160\}/, '$1 h={170}')
  await codeLine(editor.page, 'name="Card"').click()
  await editor.page.keyboard.press('ControlOrMeta+a')
  await editor.page.keyboard.insertText(code)
  await expect.poll(() => cardSize(editor.page)).toBe('320x170')

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const swatch = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.name === 'Swatch')
    if (!store || !swatch?.parentId) throw new Error('Swatch not found')
    store.graph.reorderChild(swatch.id, swatch.parentId, 0)
    store.graph.createNode('ELLIPSE', swatch.parentId, { name: 'Dot', width: 24, height: 24 })
    store.requestRender()
  })

  await expect(codeLine(editor.page, 'name="Dot"')).toBeVisible()
  await expect(editor.page.locator('[data-slot="code-editor"] .cm-lintRange-info')).toHaveText(
    'Frame'
  )
})
