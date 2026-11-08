import { openFileDialog } from '@/app/shell/menu/files'
import {
  activeTab,
  closeTab,
  createDocumentTab,
  createTab,
  openNewFileTab,
  switchAdjacentTab
} from '@/app/tabs'

/** File and tab actions shared by the browser menu and the desktop menu. */
export function createTabMenuActions(): Partial<Record<string, () => void>> {
  return {
    new: () => createTab(),
    'new-board': () => createDocumentTab('board'),
    'new-tab': () => openNewFileTab(),
    open: () => void openFileDialog(),
    close: () => {
      if (activeTab.value) void closeTab(activeTab.value.id)
    },
    'previous-tab': () => switchAdjacentTab(-1),
    'next-tab': () => switchAdjacentTab(1)
  }
}
