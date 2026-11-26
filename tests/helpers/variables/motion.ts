import type { Page } from '@playwright/test'

/** A Motion collection holding one timing and one easing, as `variable` names them. */
export async function seedMotionVariables(page: Page) {
  await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const collection = editor.graph.createCollection('Motion')
    editor.graph.createVariable('fast', 'TIMING', collection.id, 0.15)
    editor.graph.createVariable('standard', 'EASING', collection.id, { easing: 'INOUT_CUBIC' })
    editor.state.sceneVersion++
  })
}

/** A variable's stored value in its collection's first mode, found by name. */
export function storedVariableValue(page: Page, name: string) {
  return page.evaluate((variableName) => {
    const graph = window.openPencil?.getStore?.().graph
    if (!graph) throw new Error('Editor unavailable')
    const variable = [...graph.variables.values()].find(
      (candidate) => candidate.name === variableName
    )
    return variable && Object.values(variable.valuesByMode)[0]
  }, name)
}
