import type { Page } from '@playwright/test'

export type NavigationScenario = 'light' | 'large-flat' | 'raster-stress' | 'current-document'

export async function setupScenario(page: Page, scenario: NavigationScenario): Promise<void> {
  if (scenario === 'current-document') return
  await page.evaluate((selectedScenario) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not available')
    const pageId = store.state.currentPageId
    const existing = store.graph.getNode(pageId)?.childIds ?? []
    for (const id of existing) store.graph.deleteNode(id)

    let count = 1_000
    if (selectedScenario === 'light') count = 80
    else if (selectedScenario === 'large-flat') count = 5_000
    const columns = Math.ceil(Math.sqrt(count))
    for (let index = 0; index < count; index++) {
      const row = Math.floor(index / columns)
      const column = index % columns
      const type = index % 3 === 0 ? 'ELLIPSE' : 'RECTANGLE'
      store.graph.createNode(type, pageId, {
        x: column * 96,
        y: row * 96,
        width: 80,
        height: 80,
        cornerRadius: type === 'RECTANGLE' ? index % 16 : 0,
        fills: [
          {
            type: 'SOLID',
            color: {
              r: 0.2 + (index % 5) * 0.12,
              g: 0.25 + (index % 4) * 0.12,
              b: 0.45 + (index % 3) * 0.15,
              a: 1
            },
            visible: true,
            opacity: 1
          }
        ],
        effects:
          selectedScenario === 'raster-stress' && index % 4 === 0
            ? [
                {
                  type: 'DROP_SHADOW',
                  color: { r: 0, g: 0, b: 0, a: 0.35 },
                  offset: { x: 8, y: 12 },
                  radius: 16,
                  spread: 2,
                  visible: true,
                  blendMode: 'NORMAL'
                }
              ]
            : []
      })
    }
    store.requestRender()
  }, scenario)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
  )
}
