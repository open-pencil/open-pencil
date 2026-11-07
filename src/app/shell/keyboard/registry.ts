import { useEditorKeyboard, type EditorShortcut } from '@open-pencil/vue/editor/keyboard'

import { isCloudBinding, openVersionDialog } from '@/app/cloud/integration'
import { useComments } from '@/app/comments/use'
import {
  COPY_PROPERTIES_SHORTCUT,
  PASTE_PROPERTIES_SHORTCUT
} from '@/app/editor/canvas/menu/registry'
import {
  copySelectionProperties,
  pasteClipboardProperties
} from '@/app/editor/clipboard/properties'
import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import type { KeyboardShortcutOptions } from '@/app/shell/keyboard/types'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { showsDocument } from '@/app/tabs'

/** The app's keys beside the editor's: files, tabs, panels, and app-wide toggles. */
function appShortcuts(options: KeyboardShortcutOptions): EditorShortcut[] {
  const { store, actions } = options
  const menuKeys = (id: string) => {
    const shortcut = appMenuShortcut(id)
    if (!shortcut) throw new Error(`Menu item '${id}' has no shortcut`)
    return shortcut
  }
  return [
    {
      id: 'copy-properties',
      keys: COPY_PROPERTIES_SHORTCUT,
      run: () => void copySelectionProperties(store)
    },
    {
      id: 'paste-properties',
      keys: PASTE_PROPERTIES_SHORTCUT,
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
      run: () => {
        if (showsDocument()) void store.saveFigFileAs()
      }
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
    { id: 'toggle-ai', keys: 'Mod+J', run: actions.toggleAI },
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
      run: () => {
        if (showsDocument()) void store.saveFigFile()
      }
    },
    { id: 'open-file', keys: menuKeys('open'), run: options.openFileDialog }
  ]
}

/** The editor's keyboard from the SDK, with the app's own keys and Escape steps added. */
export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  useEditorKeyboard({
    shortcuts: appShortcuts(options),
    onEscape: () => useComments().closeCard()
  })
}
