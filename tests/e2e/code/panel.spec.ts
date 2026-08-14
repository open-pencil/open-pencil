import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

function codeTab() {
  return editor.page.getByTestId('properties-tab-code')
}

function designTab() {
  return editor.page.getByTestId('properties-tab-design')
}

function codePanel() {
  return editor.page.getByTestId('code-panel')
}

function codePanelEmpty() {
  return editor.page.getByTestId('code-panel-empty')
}

async function enterJSXEditing() {
  const editorInput = editor.page.locator('[data-slot="code-editor"] .cm-content')
  if (await editorInput.isVisible()) return editorInput
  await editor.page.getByTestId('code-panel-edit').click()
  await expect(editorInput).toBeVisible()
  return editorInput
}

function formatToggle() {
  return editor.page.getByTestId('code-panel-format-toggle')
}

function copyButton() {
  return editor.page.getByTestId('code-panel-copy')
}

test('inactive Code tab skips JSX generation for large selections', async () => {
  const selectionDuration = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const ids: string[] = []
    for (let frameIndex = 0; frameIndex < 50; frameIndex++) {
      const frame = store.graph.createNode('FRAME', pageId, { name: `Frame ${frameIndex}` })
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

  await codeTab().click()
  await expect(codePanel()).toContainText('Frame')

  await editor.page.evaluate(() => window.openPencil?.getStore?.().clearSelection())
  await designTab().click()
})

test('Code tab shows empty state with no selection', async () => {
  await codeTab().click()
  await expect(codePanelEmpty()).toBeVisible()
  await expect(codePanelEmpty()).toContainText('Select a layer')
})

test('selecting a rectangle shows JSX code', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.waitForRender()

  await expect(codePanel()).toBeVisible()

  const code = await codePanel().textContent()
  expect(code).toContain('Rectangle')
})

test('format toggle switches between OpenPencil and Tailwind', async () => {
  await expect(formatToggle()).toBeVisible()

  const initialFormat = await formatToggle().textContent()
  expect(initialFormat).toContain('OpenPencil')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('Tailwind')

  const code = await codePanel().textContent()
  expect(code).toContain('div')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('OpenPencil')
})

test('copy button works and shows confirmation', async () => {
  await copyButton().click()

  await expect(copyButton()).toContainText('Copied')

  await editor.page.waitForTimeout(2500)
  await expect(copyButton()).toContainText('Copy')
})

test('deselecting shows empty state again', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await expect(codePanelEmpty()).toBeVisible()
})

test('selecting a frame shows Frame in JSX', async () => {
  // Create a frame via store to avoid click-targeting issues
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('FRAME', 300, 100, 200, 200)
    store.select([id])
  })
  await editor.canvas.waitForRender()

  const code = await codePanel().textContent()
  expect(code).toContain('Frame')
})

test('edits and applies JSX as one undoable replacement', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.waitForRender()
  const originalId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return [...(store?.state.selectedIds ?? [])][0]
  })

  await codeTab().click()
  const input = await enterJSXEditing()
  await input.fill('<Frame name="Edited from JSX" w={320} h={180} fill={solid("#ffffff")} />')
  await editor.page.getByTestId('code-panel-apply-jsx').click()
  await editor.page.waitForFunction(() =>
    window.openPencil
      ?.getStore?.()
      .graph.getAllNodes()
      .some((node) => node.name === 'Edited from JSX')
  )

  const applied = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    return { selectedId, name: selectedId ? store.graph.getNode(selectedId)?.name : undefined }
  })
  expect(applied.name).toBe('Edited from JSX')
  expect(applied.selectedId).not.toBe(originalId)

  await editor.page.keyboard.press('Meta+z')
  await editor.page.waitForFunction(
    (id) => Boolean(id && window.openPencil?.getStore?.().graph.getNode(id)),
    originalId
  )
})

test('replaces multiple roots at their original positions and supports redo', async () => {
  await codeTab().click()
  const originals = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const one = store.graph.createNode('RECTANGLE', pageId, { name: 'One', x: 40, y: 50 })
    const two = store.graph.createNode('ELLIPSE', pageId, { name: 'Two', x: 240, y: 250 })
    store.select([one.id, two.id])
    return [one.id, two.id]
  })
  const input = await enterJSXEditing()
  await input.fill(
    '<><Frame name="First" w={100} h={100} /><Frame name="Second" w={100} h={100} /></>'
  )
  await editor.page.getByTestId('code-panel-apply-jsx').click()
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Second'
    )
  )
  const positions = await editor.page.evaluate(() => {
    const nodes = [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])]
    return ['First', 'Second'].map((name) => {
      const node = nodes.find((candidate) => candidate.name === name)
      return node ? { x: node.x, y: node.y } : null
    })
  })
  expect(positions).toEqual([
    { x: 40, y: 50 },
    { x: 240, y: 250 }
  ])

  await editor.page.keyboard.press('Meta+z')
  expect(
    await editor.page.evaluate(
      (ids) => ids.every((id) => window.openPencil?.getStore?.().graph.getNode(id)),
      originals
    )
  ).toBe(true)
  await editor.page.keyboard.press('Meta+Shift+z')
  await editor.page.waitForFunction(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].some(
      (node) => node.name === 'Second'
    )
  )
})

test('rolls back all roots when one cannot render', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'Keep me' })
    store.select([node.id])
  })
  await codeTab().click()
  const input = await enterJSXEditing()
  await input.fill('<><Frame name="Temporary" /><Instance /></>')
  await editor.page.getByTestId('code-panel-apply-jsx').click()
  await expect(editor.page.getByTestId('code-panel-jsx-error')).toBeVisible()
  const names = await editor.page.evaluate(() =>
    [...(window.openPencil?.getStore?.().graph.getAllNodes() ?? [])].map((node) => node.name)
  )
  expect(names).toContain('Keep me')
  expect(names).not.toContain('Temporary')
})

test('shows OpenPencil diagnostics for unknown elements and properties', async () => {
  await codeTab().click()
  const input = await enterJSXEditing()
  await input.fill('<Mystery unknownProp="value" />')
  const diagnostics = editor.page.locator('.cm-lintRange')
  await expect(diagnostics).toHaveCount(2)
  await diagnostics.first().hover()
  await expect(editor.page.locator('.cm-tooltip-lint')).toContainText('Unknown OpenPencil')
})

test('can leave edit mode without applying the draft', async () => {
  await codeTab().click()
  await enterJSXEditing()
  await expect(editor.page.locator('[data-slot="code-editor"]')).toBeVisible()
  await editor.page.getByTestId('code-panel-view').click()
  await expect(editor.page.locator('[data-slot="code-editor"]')).toBeHidden()
  await expect(editor.page.getByTestId('code-panel-edit')).toBeVisible()
})

test('keeps large JSX drafts contained inside CodeMirror', async () => {
  test.setTimeout(30_000)
  await codeTab().click()
  const editorRoot = editor.page.locator('[data-slot="code-editor"]')
  const input = await enterJSXEditing()
  const largeSource = `<Frame>${'<Text>Large draft</Text>\n'.repeat(2000)}</Frame>`
  await input.fill(largeSource)

  const geometry = await editorRoot.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.querySelector('.cm-scroller')?.scrollHeight ?? 0,
    panelHeight: element.closest('[data-test-id="code-panel-root"]')?.clientHeight ?? 0
  }))
  expect(geometry.clientHeight).toBeLessThanOrEqual(geometry.panelHeight)
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)
})

test('switching back to Design tab works', async () => {
  await designTab().click()

  await expect(
    editor.page
      .getByTestId('design-panel-single')
      .or(editor.page.getByTestId('design-panel-empty'))
      .first()
  ).toBeVisible()
})

test('shows import errors in the Code panel', async () => {
  await codeTab().click()
  await editor.page.getByTestId('code-panel-import-toggle').click()
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const importDOMText = store.importDOMText
    store.importDOMText = async () => {
      store.importDOMText = importDOMText
      throw new Error('CSS import failed')
    }
  })

  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Broken DOM</div>')
  await editor.page.getByTestId('code-panel-import').click()

  await expect(editor.page.getByTestId('code-panel-import-error')).toBeVisible()
  await expect(editor.page.getByTestId('code-panel-import-error')).toContainText(
    'CSS import failed'
  )

  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Recovered</div>')
  await expect(editor.page.getByTestId('code-panel-import-error')).toBeHidden()
  await editor.page.getByTestId('code-panel-import-toggle').click()
})

test('imports HTML and CSS into the canvas', async () => {
  await codeTab().click()
  await editor.page.getByTestId('code-panel-import-toggle').click()
  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Hello DOM</div>')
  await editor.page
    .getByTestId('code-panel-import-css')
    .fill('.card { width: 240px; height: 120px; padding: 16px; background: #ffffff; }')
  await editor.page.getByTestId('code-panel-import').click()
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getAllNodes().some((node) => node.name.includes('Hello DOM'))
  })
  await editor.canvas.waitForRender()

  const imported = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getAllNodes().some((node) => node.name.includes('Hello DOM'))
  })
  expect(imported).toBe(true)
})
