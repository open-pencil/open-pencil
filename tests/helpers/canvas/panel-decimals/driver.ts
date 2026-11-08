import type { Page } from '@playwright/test'

import { pageScene } from '#tests/helpers/canvas/page-scene'
import type * as PanelDecimalsScene from '#tests/helpers/canvas/panel-decimals/scene'

type SceneIds = ReturnType<typeof PanelDecimalsScene.createPanelDecimalsScene>

/** Builds the fractional-values scene and selects parts of it. */
export function panelDecimalsDriver(page: () => Page) {
  let ids: SceneIds | undefined

  function scene(): SceneIds {
    if (!ids) throw new Error('Build the scene first')
    return ids
  }

  return {
    async build() {
      ids = await pageScene<typeof PanelDecimalsScene>(
        page,
        '/tests/helpers/canvas/panel-decimals/scene.ts'
      ).build('createPanelDecimalsScene')
    },

    select(pick: (ids: SceneIds) => string | string[]) {
      const picked = pick(scene())
      return page().evaluate(
        (select) => window.openPencil?.getStore?.().select(select),
        Array.isArray(picked) ? picked : [picked]
      )
    },

    /** The value of the variable a layer's field is bound to, or null when it is unbound. */
    boundValue(pick: (ids: SceneIds) => string, field: string) {
      return page().evaluate(
        ({ id, field }) => {
          const store = window.openPencil?.getStore?.()
          const node = store?.graph.getNode(id)
          const variableId = node?.boundVariables[field]
          if (!store || !node || !variableId) return null
          return store.graph.resolveNumberVariableForNode(id, variableId) ?? null
        },
        { id: pick(scene()), field }
      )
    }
  }
}
