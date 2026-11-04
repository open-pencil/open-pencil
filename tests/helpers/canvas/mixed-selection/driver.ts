import type { Page } from '@playwright/test'

import type * as MixedScene from '#tests/helpers/canvas/mixed-selection/scene'
import { pageScene } from '#tests/helpers/canvas/page-scene'

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
      ids = await pageScene<typeof MixedScene>(
        page,
        '/tests/helpers/canvas/mixed-selection/scene.ts'
      ).build('createMixedSelectionScene')
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
