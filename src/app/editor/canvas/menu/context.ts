import { computed, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import { formatShortcut, type useEditorCommands } from '@open-pencil/vue/editor/commands'
import type { MenuEntry } from '@open-pencil/vue/editor/menu-model'

import type { CanvasContextTarget } from '@/app/editor/canvas/context-selection'
import type { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import {
  CANVAS_COPY_AS_ACTIONS,
  CANVAS_COPY_AS_GROUP_TEST_ID,
  CANVAS_PROPERTIES_ACTIONS,
  CANVAS_VECTORIZE_TEST_ID,
  type CanvasContextActionId,
  type CanvasContextActionMeta
} from '@/app/editor/canvas/menu/registry'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'

type CanvasMenuActions = ReturnType<typeof createCanvasMenuActions>
type CommandMenuItem = ReturnType<typeof useEditorCommands>['menuItem']

export type CanvasMenuLabels = {
  copy: string
  cut: string
  pasteHere: string
  pasteToReplace: string
  pasteAsLayers: string
  removeGuide: string
  toggleUI: string
  hideComments: string
  copyPasteAs: string
  copyAsText: string
  copyAsSVG: string
  copyAsPNG: string
  copyAsJSX: string
  copyNodeId: string
  copyXPath: string
  copyProperties: string
  pasteProperties: string
  convertToVector: string
}

/** What decides which canvas menu a right-click opens. */
export type CanvasMenuState = {
  /** What a right-click on the canvas landed on; the layers panel's menu has none. */
  target?: CanvasContextTarget
  commenting: boolean
  guideSelected: boolean
  hasSelection: boolean
  canVectorizeImage: boolean
}

export type CanvasMenuSources = {
  editor: Editor
  actions: CanvasMenuActions
  commandMenuItem: CommandMenuItem
  /** The layer commands, from the menu model shared with the layers panel. */
  layerEntries: readonly MenuEntry[]
  labels: CanvasMenuLabels
}

const separator: MenuEntry = { separator: true }

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
      return runAsync(async () =>
        actions.clipboardWrite(await editor.copySelectionAsSVG(actions.ids()), 'SVG')
      )
    case 'copy-as-png':
      return runAsync(actions.copyAsPNG)
    case 'copy-as-jsx':
      return runAsync(() => actions.clipboardWrite(editor.copySelectionAsJSX(actions.ids()), 'JSX'))
    case 'copy-node-id':
      return runAsync(actions.copyNodeId)
    case 'copy-xpath':
      return runAsync(actions.copyXPath)
    case 'copy-properties':
      return runAsync(actions.copyProperties)
    case 'paste-properties':
      return runAsync(actions.pasteProperties)
    default: {
      const exhaustive: never = id
      return exhaustive
    }
  }
}

function copyPasteAsEntry({ editor, actions, labels }: CanvasMenuSources): MenuEntry {
  const item = (meta: CanvasContextActionMeta): MenuEntry => ({
    label: labels[meta.labelKey],
    testId: meta.testId,
    shortcut: formatShortcut(meta.shortcut),
    action: copyAction(meta.id, editor, actions)
  })
  return {
    label: labels.copyPasteAs,
    testId: CANVAS_COPY_AS_GROUP_TEST_ID,
    sub: [...CANVAS_COPY_AS_ACTIONS.map(item), separator, ...CANVAS_PROPERTIES_ACTIONS.map(item)]
  }
}

/** The clipboard, which the layer commands follow without a separator. */
function clipboardEntries(state: CanvasMenuState, { actions, labels }: CanvasMenuSources) {
  const noSelection = !state.hasSelection
  return [
    {
      label: labels.copy,
      shortcut: appMenuShortcutLabel('copy'),
      testId: 'context-copy',
      disabled: noSelection,
      action: () => actions.execCommand('copy')
    },
    {
      label: labels.cut,
      shortcut: appMenuShortcutLabel('cut'),
      testId: 'context-cut',
      disabled: noSelection,
      action: () => actions.execCommand('cut')
    },
    {
      label: labels.pasteHere,
      shortcut: appMenuShortcutLabel('paste'),
      testId: 'context-paste',
      action: () => actions.execCommand('paste')
    },
    {
      label: labels.pasteToReplace,
      testId: 'context-paste-to-replace',
      disabled: noSelection,
      action: runAsync(actions.pasteToReplace)
    },
    {
      label: labels.pasteAsLayers,
      testId: 'context-paste-as-layers',
      action: actions.pasteAsLayers
    }
  ] satisfies MenuEntry[]
}

/**
 * The Comment tool's short menu, as in Figma: on a layer, whether it shows and is locked; then
 * how the canvas looks.
 */
function commentEntries(onLayer: boolean, { actions, commandMenuItem, labels }: CanvasMenuSources) {
  const layer = onLayer
    ? [
        commandMenuItem('selection.toggleVisibility'),
        commandMenuItem('selection.toggleLock'),
        separator
      ]
    : []
  return [
    ...layer,
    {
      label: labels.toggleUI,
      shortcut: appMenuShortcutLabel('toggle-ui'),
      testId: 'context-toggle-ui',
      action: actions.toggleUI
    },
    {
      label: labels.hideComments,
      shortcut: appMenuShortcutLabel('view-comments'),
      testId: 'context-hide-comments',
      action: actions.toggleCommentsOnCanvas
    }
  ] satisfies MenuEntry[]
}

/** Every entry of the menu a right-click on the canvas or a layer row opens. */
export function buildCanvasMenu(state: CanvasMenuState, sources: CanvasMenuSources): MenuEntry[] {
  const { target, commenting } = state
  if (commenting && target && target !== 'guide') return commentEntries(target === 'layer', sources)
  if (state.guideSelected) {
    return [
      {
        label: sources.labels.removeGuide,
        testId: 'context-remove-guide',
        action: sources.actions.removeSelectedGuide
      }
    ]
  }
  const entries: MenuEntry[] = [...clipboardEntries(state, sources), ...sources.layerEntries]
  if (!state.hasSelection) return entries
  if (state.canVectorizeImage) {
    entries.push(separator, {
      label: sources.labels.convertToVector,
      testId: CANVAS_VECTORIZE_TEST_ID,
      action: runAsync(sources.actions.vectorizeImage)
    })
  }
  return [...entries, separator, copyPasteAsEntry(sources)]
}

export function useCanvasContextMenu(
  state: () => Omit<CanvasMenuState, 'canVectorizeImage'>,
  sources: () => Omit<CanvasMenuSources, 'actions'>,
  actions: CanvasMenuActions
): Ref<MenuEntry[]> {
  return computed(() => {
    const current = state()
    return buildCanvasMenu(
      { ...current, canVectorizeImage: current.hasSelection && actions.canVectorizeImage() },
      { ...sources(), actions }
    )
  })
}
