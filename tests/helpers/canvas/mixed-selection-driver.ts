import type { Page } from '@playwright/test'

import type * as MixedScene from '#tests/helpers/canvas/mixed-selection'

type SceneIds = ReturnType<typeof MixedScene.createMixedSelectionScene>
export type MixedLayer = keyof SceneIds

/** Builds the mixed-selection scene, selects parts of it, and reads layers back. */
export function mixedSelectionDriver(page: () => Page) {
  let ids: SceneIds | undefined

  function idsOf(layers: readonly MixedLayer[]) {
    if (!ids) throw new Error('Build the scene first')
    const scene = ids
    return layers.map((layer) => scene[layer])
  }

  return {
    async build() {
      ids = await page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const fixtureURL = '/tests/helpers/canvas/mixed-selection.ts'
        const scene: typeof MixedScene = await import(fixtureURL)
        const built = scene.createMixedSelectionScene(store.graph, store.state.currentPageId)
        store.requestRender()
        return built
      })
    },

    select(...layers: MixedLayer[]) {
      return page().evaluate(
        (select) => window.openPencil?.getStore?.().select(select),
        idsOf(layers)
      )
    },

    /** One field of each layer, in the order asked. */
    read<K extends string>(key: K, ...layers: MixedLayer[]) {
      return page().evaluate(
        ({ key, select }) =>
          select.map((id) => {
            const node = window.openPencil?.getStore?.().graph.getNode(id)
            return node ? structuredClone(node[key as keyof typeof node] ?? null) : null
          }) as unknown[],
        { key, select: idsOf(layers) }
      )
    },

    undo() {
      return page().evaluate(() => window.openPencil?.getStore?.().undoAction())
    }
  }
}
