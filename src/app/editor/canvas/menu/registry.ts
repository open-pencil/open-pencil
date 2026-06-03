import type { TestId } from '@inkly/vue'

export type CanvasContextActionId =
  | 'copy-as-text'
  | 'copy-as-svg'
  | 'copy-as-png'
  | 'copy-as-jsx'
  | 'copy-node-id'
  | 'copy-xpath'

export type CanvasContextLabelKey =
  | 'copyAsText'
  | 'copyAsSVG'
  | 'copyAsPNG'
  | 'copyAsJSX'
  | 'copyNodeId'
  | 'copyXPath'

export type CanvasContextActionMeta = {
  id: CanvasContextActionId
  labelKey: CanvasContextLabelKey
  shortcut?: string
  testId?: TestId
}

export const CANVAS_COPY_AS_GROUP_TEST_ID = 'context-copy-paste-as' satisfies TestId
export const COPY_AS_PNG_SHORTCUT = 'MOD+SHIFT+C'

export const CANVAS_COPY_AS_ACTIONS = [
  { id: 'copy-as-text', labelKey: 'copyAsText' },
  { id: 'copy-as-svg', labelKey: 'copyAsSVG', testId: 'context-copy-as-svg' },
  { id: 'copy-as-png', labelKey: 'copyAsPNG', shortcut: COPY_AS_PNG_SHORTCUT },
  { id: 'copy-as-jsx', labelKey: 'copyAsJSX', testId: 'context-copy-as-jsx' },
  { id: 'copy-node-id', labelKey: 'copyNodeId' },
  { id: 'copy-xpath', labelKey: 'copyXPath' }
] satisfies CanvasContextActionMeta[]
