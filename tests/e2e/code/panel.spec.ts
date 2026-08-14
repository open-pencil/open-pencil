import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import {
  getCodeNodeSummaries,
  getFirstSelectedNodeId,
  getUndoLabel,
  hasNode,
  hasNodeNamed,
  waitForNode,
  waitForNodeNamed
} from '#tests/helpers/code-panel'

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

test('desktop exposes one Code panel and one editor', async () => {
  await openCodePanel()
  await expect(codePanel()).toHaveCount(1)
  await expect(codePanel().locator('.cm-editor')).toHaveCount(1)
})

test('live previews Design JSX and keeps one undo transaction', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const originalId = await getFirstSelectedNodeId(editor.page)
  await openCodePanel()
  await codeEditor().fill('<Frame name="Live JSX" w={320} h={180} fill="#ffffff" />')
  await waitForNodeNamed(editor.page, 'Live JSX')
  await codeEditor().fill('<Frame name="Live JSX final" w={360} h={180} fill="#ffffff" />')
  await waitForNodeNamed(editor.page, 'Live JSX final')

  await designTab().click()
  await editor.page.waitForTimeout(50)
  await editor.page.keyboard.press('Meta+z')
  await waitForNode(editor.page, originalId)
  expect(await hasNode(editor.page, originalId)).toBe(true)
  expect(await hasNodeNamed(editor.page, 'Live JSX final')).toBe(false)
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
  await waitForNodeNamed(editor.page, 'Last valid')
  await codeEditor().fill('<Frame>')
  const errorAlert = editor.page.getByTestId('code-panel-error')
  await expect(errorAlert).toBeVisible()
  await expect(errorAlert).toHaveCSS('color', 'rgb(248, 113, 113)')

  await editor.page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('light')
  })
  await editor.page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await expect(errorAlert).toHaveCSS('color', 'rgb(185, 28, 28)')
  expect(await hasNodeNamed(editor.page, 'Last valid')).toBe(true)
})

test('Reset restores generated source and original canvas state', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const originalId = await getFirstSelectedNodeId(editor.page)
  await openCodePanel()
  await codeEditor().fill('<Frame name="Reset preview" />')
  await waitForNodeNamed(editor.page, 'Reset preview')
  await expect(editor.page.getByTestId('code-panel-reset').locator('svg')).toHaveCount(1)
  await editor.page.getByTestId('code-panel-reset').click()
  await waitForNode(editor.page, originalId)
  expect(await hasNode(editor.page, originalId)).toBe(true)
  await expect(codeEditor()).toContainText('Rectangle')
})

test('HTML/CSS live preview commits as one undoable session', async () => {
  await editor.canvas.drawRect(80, 80, 120, 90)
  const originalId = await getFirstSelectedNodeId(editor.page)
  await openCodePanel()
  await selectSource('HTML/CSS')
  await codeEditor().fill('<div style="width: 180px; height: 90px">First</div>')
  await expect.poll(() => hasNode(editor.page, originalId)).toBe(false)
  await codeEditor().fill('<div style="width: 220px; height: 110px">Final</div>')
  await expect(editor.page.getByTestId('code-panel-status')).toContainText('Updated live')
  await expect(editor.page.getByTestId('code-panel-status')).toHaveAttribute('data-tone', 'success')

  await designTab().click()
  await expect.poll(() => getUndoLabel(editor.page)).toBe('Edit HTML/CSS')
  await editor.page.keyboard.press('Meta+z')
  await waitForNode(editor.page, originalId)
  expect(await hasNode(editor.page, originalId)).toBe(true)
  await editor.page.keyboard.press('Meta+Shift+z')
  await expect.poll(() => hasNode(editor.page, originalId)).toBe(false)
})

test('switching source formats commits the current live session', async () => {
  await editor.canvas.drawRect(90, 90, 140, 100)
  const originalId = await getFirstSelectedNodeId(editor.page)
  await openCodePanel()
  await codeEditor().fill('<Frame name="Committed on switch" />')
  await waitForNodeNamed(editor.page, 'Committed on switch')
  await selectSource('HTML/CSS')
  await expect(codeEditor()).toContainText('<style>')
  await expect.poll(() => getUndoLabel(editor.page)).toBe('Edit JSX')
  await editor.page.keyboard.press('Meta+z')
  await waitForNode(editor.page, originalId)
})

test('Reset before debounce cancels the pending preview', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const originalId = await getFirstSelectedNodeId(editor.page)
  await openCodePanel()
  await codeEditor().fill('<Frame name="Stale reset preview" />')
  await editor.page.getByTestId('code-panel-reset').click()
  await editor.page.waitForTimeout(450)
  expect(await hasNode(editor.page, originalId)).toBe(true)
  expect(await hasNodeNamed(editor.page, 'Stale reset preview')).toBe(false)
})

test('HTML/CSS uses the same editor and live reloads the canvas', async () => {
  await openCodePanel()
  await selectSource('HTML/CSS')
  await expect(codePanel().locator('[data-slot="code-editor"]')).toHaveCount(1)
  await expect(codeEditor()).toHaveAttribute('aria-label', 'HTML and CSS')
  await codeEditor().fill(
    '<style>.card { width: 240px; height: 120px; background: red; }</style><div class="card">Hello</div>'
  )
  await expect(editor.page.getByTestId('code-panel-status')).toContainText('Updated live')
  const importedNodes = await getCodeNodeSummaries(editor.page)
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
