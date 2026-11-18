import type { Editor } from '@open-pencil/core'

import type { UseCanvasOptions } from '#vue/canvas/surface/types'

interface PresentingRenderer {
  readonly tiledSceneCovered: boolean
  readonly tiledScene: { readonly visibleTileProgress: number }
}

type PresentationEditor = Pick<Editor, 'reportPresented' | 'reportProgress'> & {
  readonly state: Pick<Editor['state'], 'renderVersion' | 'sceneVersion'>
}

export function createPresentationReporter(
  editor: PresentationEditor,
  options: Pick<UseCanvasOptions, 'layer' | 'getRenderState'> | undefined
) {
  let lastVisibleTileProgress = 0
  let progressRenderer: PresentingRenderer | null = null

  return function reportPresented(renderer: PresentingRenderer) {
    const layer = options?.layer ?? 'full'
    if (layer === 'overlays') {
      return
    }
    const renderedState = options?.getRenderState?.() ?? editor.state
    const drawsAnotherState = renderedState !== editor.state
    if (drawsAnotherState) {
      return
    }
    const versions = {
      renderVersion: renderedState.renderVersion,
      sceneVersion: renderedState.sceneVersion
    }
    if (renderer !== progressRenderer) {
      progressRenderer = renderer
      lastVisibleTileProgress = 0
    }
    const visibleTileProgress = renderer.tiledScene.visibleTileProgress
    const advanced = visibleTileProgress > lastVisibleTileProgress
    lastVisibleTileProgress = visibleTileProgress
    if (layer === 'scene' && !renderer.tiledSceneCovered) {
      if (advanced) {
        editor.reportProgress(versions)
      }
      return
    }
    editor.reportPresented(versions)
  }
}
