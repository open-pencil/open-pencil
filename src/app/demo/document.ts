import { createAppPreviewSection } from '@/app/demo/sections/app-preview'
import { createComponentsSection } from '@/app/demo/sections/components'
import { createEffectsSection } from '@/app/demo/sections/effects'
import { createStandaloneShapes } from '@/app/demo/sections/standalone'
import { createDemoVariables } from '@/app/demo/sections/variables'
import { computeAllLayouts } from '@open-pencil/core/layout'

import type { EditorStore } from '@/app/editor/session'

export function createDemoShapes(store: EditorStore) {
  const { graph } = store

  const { btnCompId, badgeCompId } = createComponentsSection(store)
  computeAllLayouts(store.graph)
  const { sidebarId, headerId, frameId, headerTitle, chartTitle } = createAppPreviewSection(
    store,
    btnCompId,
    badgeCompId
  )

  createStandaloneShapes(store)
  createDemoVariables(store)
  createEffectsSection(store)

  graph.bindVariable(sidebarId, 'fills/0/color', 'var-bg')
  graph.bindVariable(headerId, 'fills/0/color', 'var-bg')
  graph.bindVariable(frameId, 'fills/0/color', 'var-bg-secondary')
  graph.bindVariable(headerTitle, 'fills/0/color', 'var-text-primary')
  graph.bindVariable(chartTitle, 'fills/0/color', 'var-text-primary')

  computeAllLayouts(store.graph)
  store.clearSelection()
}
