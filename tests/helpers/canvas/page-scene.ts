import type { Page } from '@playwright/test'

import type { ViewportTransform } from '@open-pencil/core/geometry'
import type { SceneGraph } from '@open-pencil/scene-graph'

/** A scene builder: draws on a graph's page, may take more arguments, and may return what it made. */
type SceneBuilder = (graph: SceneGraph, pageId: string, ...args: never[]) => unknown

/** The names in a scene module that are builders. */
export type SceneName<Module> = {
  [Name in keyof Module]: Module[Name] extends SceneBuilder ? Name : never
}[keyof Module] &
  string

type SceneArgs<Builder> = Builder extends (
  graph: SceneGraph,
  pageId: string,
  ...args: infer Args
) => unknown
  ? Args
  : never

type SceneResult<Builder> = Builder extends (...args: never[]) => infer Result
  ? Awaited<Result>
  : never

/**
 * Waits until the tiled scene covers the canvas with no tile work left, the background stages
 * after the quiet spell included. A new scene's tiles take several frames on a slow machine, and
 * a screenshot taken earlier shows the overlay over layers not drawn yet, or edges the background
 * stages have still to redraw. A live preview never settles, so wait only for a scene at rest.
 */
export async function waitForSettledScene(page: Page) {
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
    return (
      store?.state.navigation.phase === 'idle' &&
      renderer &&
      renderer.tiledSceneCovered &&
      !renderer.tiledScenePending &&
      !renderer.tiledSceneBackgroundPending &&
      !renderer.tiledScene.hasPendingWork()
    )
  })
}

/** Shows the open page at `view`: its zoom, and where the canvas origin sits in the canvas. */
export function showView(page: Page, view: ViewportTransform) {
  return page.evaluate((next) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = next.zoom
    store.state.panX = next.panX
    store.state.panY = next.panY
    store.requestRender()
  }, view)
}

/**
 * The builders of a scene module, run in the page on the open page's graph. `moduleURL` is the
 * module's path on the dev server, such as `/tests/helpers/canvas/blend/scene.ts`; the module is
 * imported there, so a scene draws with the page's own SceneGraph. Building clears the selection,
 * waits for the redrawn scene to settle, and returns what the builder returned.
 */
export function pageScene<Module>(page: () => Page, moduleURL: string) {
  return {
    async build<Name extends SceneName<Module>>(
      name: Name,
      ...args: SceneArgs<Module[Name]>
    ): Promise<SceneResult<Module[Name]>> {
      const built = await page().evaluate(
        async ({ url, builder, builderArgs }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const scenes: Record<string, (...args: unknown[]) => unknown> = await import(url)
          const scene = scenes[builder]
          if (!scene) throw new Error(`${url} has no scene ${builder}`)
          const built = await scene(store.graph, store.state.currentPageId, ...builderArgs)
          store.clearSelection()
          store.requestRender()
          return built
        },
        { url: moduleURL, builder: name, builderArgs: args }
      )
      await waitForSettledScene(page())
      return built as SceneResult<Module[Name]>
    }
  }
}
