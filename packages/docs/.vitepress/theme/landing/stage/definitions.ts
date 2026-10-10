import { defineAsyncComponent, type Component } from 'vue'

import type { SingleStageKind } from './kinds'
import { SCENES, type SceneBuilder } from './scenes'

// Each panel is its own chunk, so a stage downloads only the panel it shows: the AI SDK
// comes with the AI block, CodeMirror with the code blocks, and so on.
const CodePanel = defineAsyncComponent(() => import('@/components/CodePanel.vue'))
const DesignCheckPanel = defineAsyncComponent(
  () => import('@/components/design-check/DesignCheckPanel.vue')
)
const DesignPanel = defineAsyncComponent(() => import('@/components/DesignPanel.vue'))
const LayerTree = defineAsyncComponent(() => import('@/components/LayerTree/LayerTree.vue'))
const TokensPanel = defineAsyncComponent(() => import('@/components/variables/TokensPanel.vue'))
const AiChatPanel = defineAsyncComponent(() => import('./ai/AiChatPanel.vue'))
const SdkSnippetPanel = defineAsyncComponent(() => import('./panels/SdkSnippetPanel.vue'))
const TerminalPanel = defineAsyncComponent(() => import('./panels/TerminalPanel.vue'))

export interface StageDefinition {
  scene: SceneBuilder
  panel?: Component
  panelProps?: Record<string, unknown>
  /** The app nests the layer tree under a "Layers" heading; the stage supplies it. */
  layersHeading?: boolean
  toolbar?: boolean
  /** The scene starts in preview, with the app's pill to reset it or go back to editing. */
  preview?: boolean
}

export const STAGES: Record<SingleStageKind, StageDefinition> = {
  figma: { scene: SCENES.figma, panel: LayerTree, layersHeading: true },
  design: { scene: SCENES.pricingSelected, panel: DesignPanel, toolbar: true },
  interactive: { scene: SCENES.controls, panel: DesignPanel, preview: true },
  tokens: { scene: SCENES.tokens, panel: TokensPanel },
  // The Lint tab is always open: a stage's panel is always the one on screen.
  linting: { scene: SCENES.linting, panel: DesignCheckPanel, panelProps: { active: true } },
  ai: { scene: SCENES.pricing, panel: AiChatPanel },
  // Opens on the selection as a Vue component; the panel switches to React, HTML, or design JSX.
  code: { scene: SCENES.pricingSelected, panel: CodePanel, panelProps: { initialSource: 'vue' } },
  script: { scene: SCENES.pricing, panel: TerminalPanel },
  sdk: { scene: SCENES.pricing, panel: SdkSnippetPanel, toolbar: true }
}
