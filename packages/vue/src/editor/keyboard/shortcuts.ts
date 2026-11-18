import type { HotkeyChord } from '@tanstack/hotkeys'
import { uniq } from 'es-toolkit'

import {
  BOARD_TOOL_SHORTCUTS,
  resolveEditorProfile,
  TOOL_SHORTCUTS,
  type Editor
} from '@open-pencil/core'

import {
  editorCommandShortcuts,
  isShortcut,
  type EditorCommandId,
  type useEditorCommands
} from '#vue/editor/commands'

import type { createEditorKeyActions } from './actions'

/** A key binding: the shortcuts it answers to (`formatShortcut`) and what it runs. */
export interface EditorShortcut {
  id: string
  keys: HotkeyChord | readonly HotkeyChord[]
  /**
   * Runs the key's action. Returning `false` declines the key, so the shortcut it goes before on
   * the same chord runs instead: a host's Escape that closes its popover only while one is open.
   */
  run: (event: KeyboardEvent) => unknown
  /**
   * Whether the key was the editor's, so the browser's own action is stopped and a closing menu
   * that still has focus does not act on it too; by default always. Return false when the key
   * did nothing, as an unbound tool key does.
   */
  preventDefault?: (event: KeyboardEvent) => boolean
  /** Runs wherever focus is, in a text field or with a dialog open, as app-wide keys do. */
  global?: boolean
  /** Switches or leaves the canvas's view, so it runs in every view, a preview's included. */
  view?: boolean
  /** Undo or redo, which run while a picker is open and text is not being typed. */
  history?: boolean
}

const UNDO_REDO = new Set<EditorCommandId>(['edit.undo', 'edit.redo'])

/** The editor commands a key runs directly, by their registered shortcuts. */
const KEY_COMMANDS: readonly EditorCommandId[] = [
  'edit.undo',
  'edit.redo',
  'selection.createComponent',
  'selection.detachInstance',
  'selection.createComponentSet',
  'selection.toggleMask',
  'selection.toggleVisibility',
  'selection.toggleLock',
  'selection.flipHorizontal',
  'selection.flipVertical',
  'selection.tidyUp',
  'selection.distributeHorizontal',
  'selection.distributeVertical',
  'selection.ungroup',
  'selection.group',
  'selection.bringForward',
  'selection.bringToFront',
  'selection.sendBackward',
  'selection.sendToBack',
  'selection.selectParent',
  'selection.duplicate',
  'selection.selectAll',
  'selection.selectInverse',
  'view.zoom100',
  'view.zoomFit',
  'view.zoomSelection',
  'view.zoomNextFrame',
  'view.zoomPreviousFrame',
  'view.nextPage',
  'view.previousPage'
]

/**
 * Tab steps through sibling layers only while nothing on the page holds focus, so it still
 * moves focus through the panels' controls.
 */
function isCanvasFocus(event: KeyboardEvent) {
  return event.target === document.body || event.target instanceof HTMLCanvasElement
}

/**
 * A shortcut for every key a design or a board picks a tool with. Which tool a key picks, if any,
 * comes from the editor profile when it is pressed, so a board's keys and a host's tool
 * restrictions hold; a key that picks nothing leaves the browser its own action.
 */
export function toolShortcuts(editor: Editor, beforePick: () => void): EditorShortcut[] {
  const toolFor = (code: string) => resolveEditorProfile(editor.state).toolKeys[code]
  const codes = uniq([...Object.keys(TOOL_SHORTCUTS), ...Object.keys(BOARD_TOOL_SHORTCUTS)])
  return codes.map((code) => {
    if (!isShortcut(code)) throw new Error(`Tool key '${code}' is not a shortcut`)
    return toolShortcut(code)
  })

  function toolShortcut(code: HotkeyChord): EditorShortcut {
    return {
      id: `tool-${code}`,
      keys: code,
      run: () => {
        const tool = toolFor(code)
        if (!tool) return
        beforePick()
        // FigJam's R always arms a square; the toolbar's shapes keep the kind picked last.
        if (tool === 'SHAPE_WITH_TEXT') editor.setShapeWithTextKind('SQUARE')
        editor.setTool(tool)
      },
      preventDefault: () => toolFor(code) !== undefined
    }
  }
}

/** The editor's own keys, besides tool keys, the held Space hand, and nudging. */
export function editorShortcuts(
  editor: Editor,
  runCommand: ReturnType<typeof useEditorCommands>['runCommand'],
  actions: ReturnType<typeof createEditorKeyActions>
): EditorShortcut[] {
  const zoomAtViewportCenter = (delta: number) => () => {
    const { width, height } = editor.getViewportSize()
    editor.applyZoom(delta, width / 2, height / 2)
  }
  const command = (id: EditorCommandId): EditorShortcut[] => {
    const keys = editorCommandShortcuts(id)
    return keys.length > 0
      ? [{ id, keys, run: () => runCommand(id), history: UNDO_REDO.has(id) }]
      : []
  }
  const sibling = (
    id: 'selection.selectNextSibling' | 'selection.selectPreviousSibling'
  ): EditorShortcut => ({
    id,
    keys: editorCommandShortcuts(id),
    run: (event) => {
      if (isCanvasFocus(event)) runCommand(id)
    },
    preventDefault: isCanvasFocus
  })
  const bare = (event: KeyboardEvent) =>
    !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey

  return [
    ...KEY_COMMANDS.flatMap(command),
    {
      id: 'zoom-in',
      keys: ['Mod+=', 'Mod+Shift+='],
      run: zoomAtViewportCenter(-100),
      global: true
    },
    { id: 'zoom-out', keys: 'Mod+-', run: zoomAtViewportCenter(100), global: true },
    { id: 'zoom-in-unmodified', keys: 'Shift+=', run: zoomAtViewportCenter(-100) },
    { id: 'zoom-out-unmodified', keys: '-', run: zoomAtViewportCenter(100) },
    {
      id: 'toggle-auto-layout',
      keys: editorCommandShortcuts('selection.wrapInAutoLayout'),
      run: () => actions.toggleAutoLayout()
    },
    // Figma's key, matched by key position since Shift turns ' into ".
    {
      id: 'toggle-pixel-grid',
      keys: "Shift+'",
      run: () => {
        editor.state.showPixelGrid = editor.state.showPixelGrid === false
        editor.requestRepaint()
      }
    },
    {
      id: 'delete-backspace',
      keys: editorCommandShortcuts('selection.delete'),
      run: () => actions.smartDelete(false)
    },
    { id: 'delete', keys: 'Delete', run: () => actions.smartDelete(false) },
    { id: 'delete-alt', keys: 'Alt+Delete', run: () => actions.smartDelete(true) },
    {
      id: 'enter',
      keys: editorCommandShortcuts('selection.selectChildren'),
      run: () => actions.confirmOrEditSelection()
    },
    { id: 'escape', keys: 'Escape', run: () => actions.escapeOrDeselect(), view: true },
    sibling('selection.selectNextSibling'),
    sibling('selection.selectPreviousSibling'),
    ...(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map(
      (digit): EditorShortcut => ({
        id: `selection-opacity-${digit}`,
        keys: digit,
        run: (event) => {
          if (bare(event)) actions.opacityDigit(digit)
        },
        preventDefault: bare
      })
    )
  ]
}
