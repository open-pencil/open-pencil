import type { Page } from '@playwright/test'

/**
 * Builds a selected rectangle with one drop shadow in the light theme, and reads back its first
 * effect as the document holds it.
 */
export function effectDriver(page: () => Page) {
  let id: string | undefined

  return {
    async build() {
      id = await page().evaluate(async () => {
        const path = '/src/app/shell/theme.ts'
        const module = await import(path)
        module.useAppTheme().setTheme('light')
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const rectangle = store.createShape('RECTANGLE', 100, 100, 180, 120)
        store.updateNode(rectangle, {
          effects: [
            {
              type: 'DROP_SHADOW',
              color: { r: 0, g: 0, b: 0, a: 0.25 },
              offset: { x: 0, y: 4 },
              radius: 4,
              spread: 0,
              visible: true
            }
          ]
        })
        store.select([rectangle])
        return rectangle
      })
    },

    effect() {
      if (!id) throw new Error('Build the scene first')
      return page().evaluate(
        (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.effects[0],
        id
      )
    }
  }
}
