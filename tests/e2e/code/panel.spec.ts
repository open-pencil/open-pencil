import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.beforeEach(async () => {
  await editor.page.reload()
  await editor.canvas.waitForInit()
})

function codeTab() {
  return editor.page.getByTestId('properties-tab-code')
}

function designTab() {
  return editor.page.getByTestId('properties-tab-design')
}

function codePanel() {
  return editor.page.getByTestId('code-panel-root')
}

function codeEditor() {
  return editor.page.locator('[data-slot="code-editor"] .cm-content')
}

async function openCodePanel() {
  await codeTab().click()
  await expect(codeEditor()).toBeVisible()
}

async function selectSource(label: string) {
  await editor.page.getByTestId('code-panel-source').click()
  await editor.page.getByRole('option', { name: label }).click()
}

test('inactive Code tab defers JSX generation for large selections', async () => {
  const selectionDuration = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const ids: string[] = []
    for (let frameIndex = 0; frameIndex < 50; frameIndex++) {
      const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: `Frame ${frameIndex}`
      })
      ids.push(frame.id)
      for (let childIndex = 0; childIndex < 100; childIndex++) {
        store.graph.createNode('RECTANGLE', frame.id, { name: `Child ${childIndex}` })
      }
    }
    const startedAt = performance.now()
    store.select(ids)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return performance.now() - startedAt
  })
  expect(selectionDuration).toBeLessThan(1000)
  await expect(designTab()).toHaveAttribute('data-state', 'active')
  await openCodePanel()
  await expect(codeEditor()).toContainText('Frame')
})

test('shows one editor with line numbers and no import form', async () => {
  await openCodePanel()
  await expect(codePanel().locator('[data-slot="code-editor"]')).toHaveCount(1)
  await expect(codePanel().locator('.cm-lineNumbers')).toBeVisible()
  await expect(codePanel().locator('textarea')).toHaveCount(0)
  await expect(codePanel().getByRole('button', { name: /^Import$/ })).toHaveCount(0)
})

test('live previews Design JSX and keeps one undo transaction', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const originalId = await editor.page.evaluate(
    () => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])][0]
  )
  await openCodePanel()
  await codeEditor().fill('<Frame name="Live JSX" w={320} h={180} fill="#ffffff" />')
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Live JSX'
    )
  )
  await codeEditor().fill('<Frame name="Live JSX final" w={360} h={180} fill="#ffffff" />')
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Live JSX final'
    )
  )

  await designTab().click()
  await editor.page.waitForTimeout(50)
  await editor.page.keyboard.press('Meta+z')
  await editor.page.waitForFunction(
    (id) => Boolean(id && window.openPencil?.getStore?.().graph.getNode(id)),
    originalId
  )
  expect(
    await editor.page.evaluate(
      (id) => Boolean(id && window.openPencil?.getStore?.().graph.getNode(id)),
      originalId
    )
  ).toBe(true)
  expect(
    await editor.page.evaluate(() =>
      [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
        (node) => node.name === 'Live JSX final'
      )
    )
  ).toBe(false)
})

test('Ctrl+Z edits the CodeMirror draft before touching the canvas transaction', async () => {
  await openCodePanel()
  const initial = await codeEditor().textContent()
  await codeEditor().pressSequentially('\n// local draft')
  await expect(codeEditor()).toContainText('local draft')
  await codeEditor().press('Control+z')
  await expect(codeEditor()).not.toContainText('local draft')
  expect(await codeEditor().textContent()).toBe(initial)
})

test('keeps the last valid preview while showing invalid-code diagnostics', async () => {
  await openCodePanel()
  await codeEditor().fill('<Frame name="Last valid" />')
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Last valid'
    )
  )
  await codeEditor().fill('<Frame>')
  await expect(editor.page.getByTestId('code-panel-error')).toBeVisible()
  expect(
    await editor.page.evaluate(() =>
      [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
        (node) => node.name === 'Last valid'
      )
    )
  ).toBe(true)
})

test('Reset restores generated source and original canvas state', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const originalId = await editor.page.evaluate(
    () => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])][0]
  )
  await openCodePanel()
  await codeEditor().fill('<Frame name="Reset preview" />')
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Reset preview'
    )
  )
  await editor.page.getByTestId('code-panel-reset').click()
  await editor.page.waitForFunction(
    (id) => Boolean(id && window.openPencil?.getStore?.().graph.getNode(id)),
    originalId
  )
  expect(
    await editor.page.evaluate(
      (id) => Boolean(id && window.openPencil?.getStore?.().graph.getNode(id)),
      originalId
    )
  ).toBe(true)
  await expect(codeEditor()).toContainText('Rectangle')
})

test('HTML/CSS uses the same editor and live reloads the canvas', async () => {
  await openCodePanel()
  await selectSource('HTML/CSS')
  await expect(codePanel().locator('[data-slot="code-editor"]')).toHaveCount(1)
  await codeEditor().fill(
    '<style>.card { width: 240px; height: 120px; background: red; }</style><div class="card">Hello</div>'
  )
  await expect(editor.page.getByTestId('code-panel-status')).toContainText('Updated live')
  const importedNodes = await editor.page.evaluate(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].map((node) => ({
      type: node.type,
      name: node.name,
      text: node.text
    }))
  )
  expect(importedNodes.some((node) => node.type !== 'DOCUMENT' && node.type !== 'PAGE')).toBe(true)
})

test('Tailwind JSX is generated read-only in the same editor', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await openCodePanel()
  await selectSource('Tailwind JSX')
  await expect(editor.page.getByTestId('code-panel-status')).toContainText('Generated, read only')
  await expect(codeEditor()).toHaveAttribute('contenteditable', 'false')
})

test('copy button works and shows confirmation', async () => {
  await openCodePanel()
  await editor.page.getByTestId('code-panel-copy').click()
  await expect(editor.page.getByTestId('code-panel-copy')).toContainText('Copied')
})
