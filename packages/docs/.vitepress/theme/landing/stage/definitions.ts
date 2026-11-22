import { defineAsyncComponent, type Component } from 'vue'

import type { SingleStageKind } from './kinds'
import { SCENES, type SceneBuilder } from './scenes'

/**
 * A component a stage downloads only when it shows it, with the loader, so the stage can have it
 * in place before it reports its scene on screen.
 */
export interface LazyComponent {
  component: Component
  load: () => Promise<unknown>
}

export function lazy(load: () => Promise<{ default: Component }>): LazyComponent {
  return { component: defineAsyncComponent(load), load }
}

// Each panel is its own chunk, so a stage downloads only the panel it shows: the AI SDK
// comes with the AI block, CodeMirror with the code blocks, and so on.
const CodePanel = lazy(() => import('@/components/CodePanel.vue'))
const DesignCheckPanel = lazy(() => import('@/components/design-check/DesignCheckPanel.vue'))
const DesignPanel = lazy(() => import('@/components/DesignPanel.vue'))
const LayerTree = lazy(() => import('@/components/LayerTree/LayerTree.vue'))
const TokensPanel = lazy(() => import('@/components/variables/TokensPanel.vue'))
const AIChatPanel = lazy(() => import('./ai/AIChatPanel.vue'))
const SdkSnippetPanel = lazy(() => import('./panels/SdkSnippetPanel.vue'))
const TerminalPanel = lazy(() => import('./panels/TerminalPanel.vue'))

export interface StageDefinition {
  scene: SceneBuilder
  panel?: LazyComponent
  panelProps?: Record<string, unknown>
  /** The app nests the layer tree under a "Layers" heading; the stage supplies it. */
  layersHeading?: boolean
  toolbar?: boolean
  /** The scene starts in preview, with the app's pill to reset it or go back to editing. */
  preview?: boolean
}

export const STAGES: Record<SingleStageKind, StageDefinition> = {
  figma: { scene: SCENES.figma, panel: LayerTree, layersHeading: true },
  design: { scene: SCENES.slots, panel: DesignPanel, toolbar: true },
  // A board opens on the canvas and its tools alone, as boards do in the app.
  board: { scene: SCENES.board, toolbar: true },
  interactive: { scene: SCENES.hero, panel: DesignPanel, preview: true },
  tokens: { scene: SCENES.modes, panel: TokensPanel },
  shaders: { scene: SCENES.shaders, panel: DesignPanel, preview: true },
  // The Lint tab is always open: a stage's panel is always the one on screen.
  linting: {
    scene: SCENES.lint,
    panel: DesignCheckPanel,
    panelProps: { active: true, initialScope: 'selection' }
  },
  // The recorded turn adds a card beside the player in the hero.
  ai: { scene: SCENES.heroStill, panel: AIChatPanel },
  // Opens on the selection as a Vue component; the panel switches to React, HTML, or design JSX.
  code: { scene: SCENES.code, panel: CodePanel, panelProps: { initialSource: 'vue' } },
  // The terminal's scripts recolor the players' accent and add a player to the row.
  script: { scene: SCENES.players, panel: TerminalPanel },
  sdk: { scene: SCENES.controls, panel: SdkSnippetPanel, toolbar: true }
}
