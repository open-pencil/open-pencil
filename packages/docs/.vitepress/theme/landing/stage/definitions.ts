import type { Component } from 'vue'

import CodePanel from '@/components/CodePanel.vue'
import DesignCheckPanel from '@/components/design-check/DesignCheckPanel.vue'
import DesignPanel from '@/components/DesignPanel.vue'
import LayerTree from '@/components/LayerTree/LayerTree.vue'
import TokensPanel from '@/components/variables/TokensPanel.vue'

import AiChatPanel from './ai/AiChatPanel.vue'
import type { StageKind } from './kinds'
import SdkSnippetPanel from './panels/SdkSnippetPanel.vue'
import TerminalPanel from './panels/TerminalPanel.vue'
import { SCENES, type SceneBuilder } from './scenes'

export interface StageDefinition {
  scene: SceneBuilder
  panel?: Component
  panelProps?: Record<string, unknown>
  /** The app nests the layer tree under a "Layers" heading; the stage supplies it. */
  layersHeading?: boolean
  /** Panels laid out for a dialog, such as the token editor, get more room. */
  widePanel?: boolean
  toolbar?: boolean
  /** The scene starts in preview, with the app's pill to reset it or go back to editing. */
  preview?: boolean
}

export const STAGES: Record<StageKind, StageDefinition> = {
  hero: { scene: SCENES.announcement, toolbar: true },
  figma: { scene: SCENES.figma, panel: LayerTree, layersHeading: true },
  design: { scene: SCENES.pricingSelected, panel: DesignPanel, toolbar: true },
  interactive: { scene: SCENES.controls, panel: DesignPanel, preview: true },
  tokens: { scene: SCENES.tokens, panel: TokensPanel, widePanel: true },
  // The Lint tab is always open: a stage's panel is always the one on screen.
  linting: { scene: SCENES.linting, panel: DesignCheckPanel, panelProps: { active: true } },
  ai: { scene: SCENES.pricing, panel: AiChatPanel },
  code: { scene: SCENES.pricingSelected, panel: CodePanel },
  script: { scene: SCENES.pricing, panel: TerminalPanel },
  sdk: { scene: SCENES.pricing, panel: SdkSnippetPanel, toolbar: true }
}
