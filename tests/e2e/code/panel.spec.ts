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

function formatToggle() {
  return editor.page.getByTestId('code-panel-format-toggle')
}

function copyButton() {
  return editor.page.getByTestId('code-panel-copy')
}

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

test('switching back to Design tab works', async () => {
  await designTab().click()

  await expect(editor.page.getByTestId('design-panel-single').or(editor.page.getByTestId('design-panel-empty')).first()).toBeVisible()
})
