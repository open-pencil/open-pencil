import { computed, type Ref } from 'vue'

import { formatShortcut, type Editor, type MenuEntry } from '@open-pencil/vue'

import type { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import {
  CANVAS_COPY_AS_ACTIONS,
  CANVAS_COPY_AS_GROUP_TEST_ID,
  type CanvasContextActionId
} from '@/app/editor/canvas/menu/registry'

const STATIC_SELECTION_COMMAND_IDS = new Set(['selection.duplicate', 'selection.delete'])

type CanvasMenuActions = ReturnType<typeof createCanvasMenuActions>

type CanvasCopyLabels = {
  copyPasteAs: string
  copyAsText: string
  copyAsSVG: string
  copyAsPNG: string
  copyAsJSX: string
  copyNodeId: string
  copyXPath: string
}

function withoutStaticSelectionCommands(entries: readonly MenuEntry[]): MenuEntry[] {
  return entries.filter((entry) => {
    if (entry.separator) return true
    return !entry.id || !STATIC_SELECTION_COMMAND_IDS.has(entry.id)
  })
}

function runAsync(action: () => Promise<void>) {
  return () => {
    void action()
  }
}

function copyAction(
  id: CanvasContextActionId,
  editor: Editor,
  actions: CanvasMenuActions
): () => void {
  switch (id) {
    case 'copy-as-text':
      return runAsync(() =>
        actions.clipboardWrite(editor.copySelectionAsText(actions.ids()), 'text')
      )
    case 'copy-as-svg':
      return runAsync(() => actions.clipboardWrite(editor.copySelectionAsSVG(actions.ids()), 'SVG'))
    case 'copy-as-png':
      return runAsync(actions.copyAsPNG)
    case 'copy-as-jsx':
      return runAsync(() => actions.clipboardWrite(editor.copySelectionAsJSX(actions.ids()), 'JSX'))
    case 'copy-node-id':
      return runAsync(actions.copyNodeId)
    case 'copy-xpath':
      return runAsync(actions.copyXPath)
    default: {
      const exhaustive: never = id
      return exhaustive
    }
  }
}

function copyPasteAsEntry(
  editor: Editor,
  actions: CanvasMenuActions,
  labels: CanvasCopyLabels
): MenuEntry {
  return {
    label: labels.copyPasteAs,
    testId: CANVAS_COPY_AS_GROUP_TEST_ID,
    sub: CANVAS_COPY_AS_ACTIONS.map((meta) => ({
      label: labels[meta.labelKey],
      testId: meta.testId,
      shortcut: formatShortcut(meta.shortcut),
      action: copyAction(meta.id, editor, actions)
    }))
  }
}

export function useCanvasContextMenu(
  baseEntries: Ref<MenuEntry[]>,
  hasSelection: Ref<boolean>,
  editor: Editor,
  actions: CanvasMenuActions,
  labels: Ref<CanvasCopyLabels>
) {
  return computed<MenuEntry[]>(() => {
    const entries = withoutStaticSelectionCommands(baseEntries.value)
    if (!hasSelection.value) return entries
    return [...entries, { separator: true }, copyPasteAsEntry(editor, actions, labels.value)]
  })
}
