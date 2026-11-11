import { useEditorKeyboard, type EditorShortcut } from '@open-pencil/vue/editor/keyboard'

import { isCloudBinding, openVersionDialog } from '@/app/cloud/integration'
import { useComments } from '@/app/comments/use'
import type { EditorStore } from '@/app/editor/active-store'
import {
  copySelectionProperties,
  pasteClipboardProperties
} from '@/app/editor/clipboard/properties'
import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import type { KeyboardShortcutOptions } from '@/app/shell/keyboard/types'
import { createSaveMenuActions } from '@/app/shell/menu/save-actions'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'

/**
 * The app's keys beside the editor's: files, tabs, panels, and app-wide toggles. Saving is global,
 * as in Figma: held back while text is edited or a field has focus, Mod+S would reach the browser,
 * which offers to save the page instead.
 */
export function appShortcuts(options: KeyboardShortcutOptions): EditorShortcut[] {
  const { store, actions } = options
  // The menus' save actions, which commit a field being typed in before writing the file.
  const saving = createSaveMenuActions()
  const menuKeys = (id: string) => {
    const shortcut = appMenuShortcut(id)
    if (!shortcut) throw new Error(`Menu item '${id}' has no shortcut`)
    return shortcut
  }
  return [
    {
      id: 'copy-properties',
      keys: menuKeys('copy-properties'),
      run: () => void copySelectionProperties(store)
    },
    {
      id: 'paste-properties',
      keys: menuKeys('paste-properties'),
      run: () => void pasteClipboardProperties(store)
    },
    {
      id: 'export-selection-png',
      keys: menuKeys('export-selection'),
      run: () => actions.exportSelectionPNG()
    },
    {
      id: 'save-as',
      keys: menuKeys('save-as'),
      run: saving['save-as'],
      global: true
    },
    {
      id: 'save-version',
      keys: menuKeys('save-version'),
      run: () => {
        if (isCloudBinding(store.getStorageBinding())) openVersionDialog(store)
      }
    },
    {
      id: 'toggle-preview',
      keys: menuKeys('toggle-preview'),
      run: () => actions.togglePlay(),
      view: true
    },
    {
      id: 'toggle-rulers',
      keys: menuKeys('view-rulers'),
      run: () => {
        store.state.showRulers = !store.state.showRulers
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-multiplayer-cursors',
      keys: menuKeys('view-multiplayer-cursors'),
      run: () => {
        store.state.showRemoteCursors = !store.state.showRemoteCursors
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-pixel-grid-snap',
      keys: menuKeys('snap-pixel-grid'),
      run: () => setSnappingPreference('pixelGrid', !store.state.snappingPreferences.pixelGrid)
    },
    { id: 'toggle-ui', keys: menuKeys('toggle-ui'), run: actions.toggleUI },
    {
      id: 'split-right',
      keys: menuKeys('view-split-right'),
      run: () => {
        if (store.visiblePaneCount.value < store.panes.maxVisiblePanes)
          store.splitPane(store.activePaneId.value, 'horizontal')
      }
    },
    { id: 'toggle-ai', keys: menuKeys('toggle-ai'), run: actions.toggleAI },
    {
      id: 'toggle-comments',
      keys: menuKeys('view-comments'),
      run: () => useComments().toggleOnCanvas()
    },
    {
      id: 'open-settings',
      keys: menuKeys('settings'),
      run: () => openSettingsDialog(),
      global: true
    },
    { id: 'close-tab', keys: menuKeys('close'), run: options.closeActiveTab },
    { id: 'new-design', keys: menuKeys('new'), run: options.createTab },
    { id: 'new-tab', keys: menuKeys('new-tab'), run: options.openNewFileTab },
    {
      id: 'next-tab',
      keys: menuKeys('next-tab'),
      run: () => options.switchAdjacentTab(1),
      global: true
    },
    {
      id: 'previous-tab',
      keys: menuKeys('previous-tab'),
      run: () => options.switchAdjacentTab(-1),
      global: true
    },
    {
      id: 'rename-selection',
      keys: menuKeys('selection.rename'),
      run: () => requestRenameSelection(store)
    },
    {
      id: 'save',
      keys: menuKeys('save'),
      run: saving.save,
      global: true
    },
    { id: 'open-file', keys: menuKeys('open'), run: options.openFileDialog },
    // An open comment card takes Escape first; with none open the editor's Escape runs.
    { id: 'close-comment-card', keys: 'Escape', run: () => useComments().closeCard() }
  ]
}

/** The editor's keyboard from the SDK, with the app's own keys added. */
export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  useEditorKeyboard({
    shortcuts: appShortcuts(options),
    ignore: keysHeldWhilePreparing(options.store)
  })
}

/**
 * Whether the editor's own keys wait: a document with a loader over it is being read or replaced,
 * so a key pressed now edits the document that is about to go away, and its edit — a nudge, a
 * delete, a paste — is thrown away with it while the reload marks the file saved.
 *
 * A font retry is not that: the document is the one on screen and only its text is being laid
 * out, which is the same reason the canvas keeps drawing and its loader stays away during one.
 */
export function keysHeldWhilePreparing(store: EditorStore): () => boolean {
  return () => {
    const preparation = store.state.preparation
    return preparation !== null && preparation.kind !== 'font-retry'
  }
}
