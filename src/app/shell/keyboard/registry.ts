import { useEditorKeyboard, type EditorShortcut } from '@open-pencil/vue/editor/keyboard'

import { isCloudBinding, openVersionDialog } from '@/app/cloud/integration'
import { useComments } from '@/app/comments/use'
import {
  copySelectionProperties,
  pasteClipboardProperties
} from '@/app/editor/clipboard/properties'
import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import type { KeyboardShortcutOptions } from '@/app/shell/keyboard/types'
import { appMenuTinykeysShortcut } from '@/app/shell/menu/shortcut'
import { showsDocument } from '@/app/tabs'

/** The app's keys beside the editor's: files, tabs, panels, and app-wide toggles. */
function appShortcuts(options: KeyboardShortcutOptions): EditorShortcut[] {
  const { store, actions } = options
  const menuKeys = (id: string, fallback: string) => appMenuTinykeysShortcut(id) ?? fallback
  return [
    {
      id: 'copy-properties',
      keys: '$mod+Alt+KeyC',
      run: () => void copySelectionProperties(store)
    },
    {
      id: 'paste-properties',
      keys: '$mod+Alt+KeyV',
      run: () => void pasteClipboardProperties(store)
    },
    {
      id: 'export-selection-png',
      keys: menuKeys('export-selection', '$mod+Shift+KeyE'),
      run: () => actions.exportSelectionPNG()
    },
    {
      id: 'save-as',
      keys: menuKeys('save-as', '$mod+Shift+KeyS'),
      run: () => {
        if (showsDocument()) void store.saveFigFileAs()
      }
    },
    {
      id: 'save-version',
      keys: menuKeys('save-version', '$mod+Alt+KeyS'),
      run: () => {
        if (isCloudBinding(store.getStorageBinding())) openVersionDialog(store)
      }
    },
    {
      id: 'toggle-preview',
      keys: menuKeys('toggle-preview', '$mod+Alt+Enter'),
      run: () => actions.togglePlay(),
      view: true
    },
    {
      id: 'toggle-rulers',
      keys: 'Shift+KeyR',
      run: () => {
        store.state.showRulers = !store.state.showRulers
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-multiplayer-cursors',
      keys: '$mod+Alt+Backslash',
      run: () => {
        store.state.showRemoteCursors = !store.state.showRemoteCursors
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-pixel-grid-snap',
      keys: '$mod+Shift+Quote',
      run: () => setSnappingPreference('pixelGrid', !store.state.snappingPreferences.pixelGrid)
    },
    { id: 'toggle-ui', keys: menuKeys('toggle-ui', '$mod+Backslash'), run: actions.toggleUI },
    // Matched by key position, since Shift turns \ into | on most layouts.
    {
      id: 'split-right',
      keys: '$mod+Shift+Backslash',
      run: () => {
        if (store.visiblePaneCount.value < store.panes.maxVisiblePanes)
          store.splitPane(store.activePaneId.value, 'horizontal')
      }
    },
    { id: 'toggle-ai', keys: '$mod+KeyJ', run: actions.toggleAI },
    {
      id: 'toggle-comments',
      keys: menuKeys('view-comments', 'Shift+KeyC'),
      run: () => useComments().toggleOnCanvas()
    },
    {
      id: 'open-settings',
      keys: menuKeys('settings', '$mod+Comma'),
      run: () => openSettingsDialog(),
      global: true
    },
    { id: 'close-tab', keys: menuKeys('close', '$mod+KeyW'), run: options.closeActiveTab },
    { id: 'new-design', keys: menuKeys('new', '$mod+KeyN'), run: options.createTab },
    { id: 'new-tab', keys: menuKeys('new-tab', '$mod+KeyT'), run: options.openNewFileTab },
    {
      id: 'next-tab',
      keys: 'Control+Tab',
      run: () => options.switchAdjacentTab(1),
      global: true
    },
    {
      id: 'previous-tab',
      keys: 'Control+Shift+Tab',
      run: () => options.switchAdjacentTab(-1),
      global: true
    },
    {
      id: 'rename-selection',
      keys: menuKeys('selection.rename', '$mod+KeyR'),
      run: () => requestRenameSelection(store)
    },
    {
      id: 'save',
      keys: menuKeys('save', '$mod+KeyS'),
      run: () => {
        if (showsDocument()) void store.saveFigFile()
      }
    },
    { id: 'open-file', keys: menuKeys('open', '$mod+KeyO'), run: options.openFileDialog }
  ]
}

/** The editor's keyboard from the SDK, with the app's own keys and Escape steps added. */
export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  useEditorKeyboard({
    shortcuts: appShortcuts(options),
    onEscape: () => useComments().closeCard()
  })
}
