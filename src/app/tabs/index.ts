import { openFileInNewTab } from '@/app/tabs/open/file'
import {
  discardRecoverySnapshot,
  listRecoverySnapshots,
  restoreRecoverySnapshot
} from '@/app/tabs/open/recovery'
import { openStorageDocumentInNewTab } from '@/app/tabs/open/storage'
import {
  activeTabId,
  allTabs,
  closeTab,
  createHomeTab,
  createTab,
  getActiveStore,
  getActiveTabId,
  getTabById,
  getTabForStore,
  getTabsSnapshot,
  prepareForReload,
  switchTab,
  tabCount
} from '@/app/tabs/state'

export { openFileInNewTab } from '@/app/tabs/open/file'
export { readFigBytes } from '@/app/tabs/open/fig'
export {
  discardRecoverySnapshot,
  listRecoverySnapshots,
  restoreRecoverySnapshot
} from '@/app/tabs/open/recovery'
export { onTabDocumentReplaced } from '@/app/tabs/open/show'
export { openStorageDocumentInNewTab, reloadStorageDocumentInTab } from '@/app/tabs/open/storage'
export {
  activeTab,
  allTabs,
  closeTab,
  createDocumentTab,
  createHomeTab,
  createTab,
  ensureHomeTab,
  getActiveStore,
  getActiveTabId,
  getTabById,
  getTabForStore,
  getTabsSnapshot,
  openNewFileTab,
  openRecoveryIds,
  prepareForClose,
  prepareForReload,
  showNewTab,
  showsDocument,
  switchAdjacentTab,
  switchTab,
  tabCount,
  withHomePinned,
  type Tab,
  type TabKind
} from '@/app/tabs/state'

export function useTabsStore() {
  return {
    tabs: allTabs,
    activeTabId,
    createHomeTab,
    createTab,
    switchTab,
    closeTab,
    getActiveTabId,
    getTabById,
    getTabForStore,
    getTabsSnapshot,
    openFileInNewTab,
    openStorageDocumentInNewTab,
    listRecoverySnapshots,
    restoreRecoverySnapshot,
    discardRecoverySnapshot,
    prepareForReload,
    getActiveStore,
    tabCount
  }
}
