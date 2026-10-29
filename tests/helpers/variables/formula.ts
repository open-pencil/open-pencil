import type { Locator, Page } from '@playwright/test'

/** A number and Boolean token bound to ordinary frame geometry and visibility. */
export async function seedFormulaScene(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const collection = graph.createCollection('Formula tokens')
    const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
    const width = graph.createVariable('size', 'FLOAT', collection.id, 8)
    const enabled = graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
    const visible = graph.createVariable('visible', 'BOOLEAN', collection.id, true)
    const node = graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Formula consumer',
      x: 100,
      y: 100,
      width: 8,
      height: 20,
      boundVariables: { width: width.id, visible: visible.id }
    })
    editor.requestRender()
    return {
      base: base.id,
      width: width.id,
      enabled: enabled.id,
      visible: visible.id,
      node: node.id,
      mode: collection.defaultModeId
    }
  })
}

export async function formulaSceneState(
  page: Page,
  ids: Awaited<ReturnType<typeof seedFormulaScene>>
) {
  return page.evaluate(({ node, width, visible, mode }) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    return {
      width: editor.graph.getNode(node)?.width,
      visible: editor.graph.getNode(node)?.visible,
      numberDefinition: editor.graph.variables.get(width)?.valuesByMode[mode],
      booleanDefinition: editor.graph.variables.get(visible)?.valuesByMode[mode]
    }
  }, ids)
}

/** Apply a document update without moving focus out of the value editor. */
export async function updateFormulaNumber(
  page: Page,
  ids: Awaited<ReturnType<typeof seedFormulaScene>>,
  value: number
) {
  await page.evaluate(
    ({ width, mode, value }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      editor.updateVariableValue(width, mode, value)
    },
    { ...ids, value }
  )
}

/** Paste through the editor's clipboard handler, preserving a distinct undoable edit. */
export async function pasteFormulaText(field: Locator, text: string) {
  await field.press('Meta+a')
  await field.evaluate((element, text) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    )
  }, text)
}
