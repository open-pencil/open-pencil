import type { Page } from '@playwright/test'

export async function seedLibraryCopies(page: Page) {
  await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const { graph } = editor
    const theme = graph.createCollection('Theme')
    graph.renameMode(theme.id, theme.defaultModeId, 'Light')
    graph.createMode(theme.id, 'Dark')
    const radius = graph.createVariable('radius', 'FLOAT', theme.id, 4)
    Object.assign(theme, { key: 'theme-a', version: '1:1' })
    Object.assign(radius, { key: 'radius-a', version: '1:1', hiddenFromPublishing: true })
    graph.addCollection({
      ...structuredClone(theme),
      id: `${theme.id}-copy`,
      key: 'theme-b',
      variableIds: []
    })
    const size = graph.createCollection('Size')
    graph.createVariable('gap', 'FLOAT', size.id, 8)
    graph.createVariable('icon', 'FLOAT', size.id, 16)
    editor.requestRender()
  })
}
