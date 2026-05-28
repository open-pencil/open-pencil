import type { EditorViewState, PageViewport } from '@open-pencil/core/editor'

import type { NodeEditState } from '@/app/editor/vector-edit/types'

export type SplitDirection = 'horizontal' | 'vertical'

export type CanvasSplitNode =
  | { type: 'pane'; paneId: string }
  | {
      type: 'split'
      id: string
      direction: SplitDirection
      children: CanvasSplitNode[]
      sizes: number[]
    }

export interface AppCanvasPaneState extends EditorViewState {
  id: string
  cursorCanvasX: number | null
  cursorCanvasY: number | null
  nodeEditState: NodeEditState | null
  pageViewports: Map<string, PageViewport>
  viewportWidth: number
  viewportHeight: number
}

export type SplitPaneResult =
  | { ok: true; paneId: string }
  | { ok: false; reason: 'pane-cap' | 'missing-pane' }

export type ClosePaneResult =
  | { ok: true; activePaneId: string }
  | { ok: false; reason: 'last-pane' | 'missing-pane' }
