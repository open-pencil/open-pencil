<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener, whenever } from '@vueuse/core'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useI18n } from '@open-pencil/vue/i18n'

import {
  aiSetupDialogOpen,
  offerAISetupOnFirstRun
} from '@/app/ai/models/settings/onboarding/dialog'
import { exposeAutomationTestRequests } from '@/app/automation/bridge/test-hooks'
import { startMCPRuntime, stopMCPRuntime } from '@/app/automation/mcp/runtime'
import { startWebMCP } from '@/app/automation/webmcp/runtime'
import { exposeCollaborationActions } from '@/app/browser-bridge'
import { openingCloudLink, shownEditorStore, versionPreviewKey } from '@/app/cloud/integration'
import { useJoinRoom } from '@/app/collab/join'
import { bindDesktopRoomLinks } from '@/app/collab/room/links'
import { COLLAB_KEY, useCollab } from '@/app/collab/use'
import { openDemoDocument } from '@/app/demo/document'
import type { PendingOpenFile } from '@/app/document/io/pending-open'
import { openPendingFiles } from '@/app/document/io/pending-open'
import { openWebLinkFromLocation, withoutWebLinkParams } from '@/app/document/io/web-link'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { focusNodesByName } from '@/app/editor/selection/focus'
import { notificationMessages } from '@/app/i18n/notifications'
import { recentFilesAvailable } from '@/app/recent-files/preferences'
import { appRuntimeConfig } from '@/app/runtime/config'
import { useDocumentDrop } from '@/app/shell/document-drop'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { useEditorMenu } from '@/app/shell/menu/use'
import { toast } from '@/app/shell/ui'
import {
  activeTab,
  createHomeTab,
  ensureHomeTab,
  createTab,
  getActiveStore,
  getTabsSnapshot,
  tabCount,
  type Tab
} from '@/app/tabs'
import { syncTabAddress } from '@/app/tabs/address'
import { isTauri } from '@/app/tauri/env'
import { offerUsageStatsPrompt, startSharing } from '@/app/telemetry'
import ColorSpaceBanner from '@/components/canvas/ColorSpaceBanner.vue'
import { CloudVersionDialog } from '@/components/cloud/integration'
import CommandPalette from '@/components/commands/CommandPalette.vue'
import EditorWorkspace from '@/components/editor/EditorWorkspace.vue'
import FileApiBanner from '@/components/FileApiBanner.vue'
import FontStatusBanner from '@/components/font-status/FontStatusBanner.vue'
import HomeWorkspace from '@/components/home/HomeWorkspace.vue'
import RenameSelectionDialog from '@/components/selection/RenameSelectionDialog.vue'
import LoadingScreen from '@/components/shell/LoadingScreen.vue'
import TabBar from '@/components/TabBar.vue'
import { IS_BROWSER, IS_CLOUD_SITE } from '@/constants'

const route = useRoute()
/**
 * The active tab as it shows: a version of its document being previewed takes the document's
 * place, in a workspace of its own, until the history goes back to the document.
 */
const shown = computed(() => {
  const tab = activeTab.value
  if (!tab) return null
  return {
    tab: { ...tab, store: shownEditorStore(tab.store) },
    key: tab.id + versionPreviewKey(tab.store)
  }
})
// Shortcuts, menus, and the clipboard act on what the tab shows.
watch(
  () => shown.value?.tab.store,
  (store) => {
    if (store) setActiveEditorStore(store)
  }
)
const router = useRouter()
const createdInitialTab = tabCount() === 0
// Home is pinned first everywhere but tests and the demo, and opens in front where it lists
// something: recent files, or the workspaces of the Cloud server that serves the editor.
const pinHome = !appRuntimeConfig.test && !route.meta.demo
const showHomeFirst = route.path === '/' && pinHome && (recentFilesAvailable() || IS_CLOUD_SITE)
// The view stays mounted from /demo to /, so Home is pinned once a route that has it is reached.
watch(
  () => !appRuntimeConfig.test && !route.meta.demo,
  (pins) => {
    if (pins) ensureHomeTab()
  }
)
/**
 * A Cloud link's first tab is Home, beside which the document it opens gets its own tab; Home is
 * also where a link that fails or waits for a sign-in leaves the person, never an empty document.
 */
const opensCloudLink = ['documentId', 'shareId', 'invitationId'].some(
  (param) => typeof route.params[param] === 'string'
)
const { collaboration } = useI18n()
const joinRoomFromInput = useJoinRoom()

/**
 * A share link opens its room in a tab of its own, so nothing editable shows before it. Home, where
 * the app has one, is pinned first behind it.
 */
function openFirstTab(): Tab {
  const roomId = typeof route.params.roomId === 'string' ? route.params.roomId : null
  if (pinHome) createHomeTab()
  if (roomId) {
    if (joinRoomFromInput(roomId) && activeTab.value) return activeTab.value
    toast.error(collaboration.value.invalidRoomLink)
    // A link that fails leaves the person on Home, not in an empty design.
    if (pinHome) return createHomeTab()
  }
  return showHomeFirst || opensCloudLink ? createHomeTab() : createTab()
}

// Block-scoped so the view does not keep the first tab's store after that tab closes.
{
  const firstTab = activeTab.value ?? openFirstTab()
  if (createdInitialTab && route.meta.demo && !appRuntimeConfig.test) {
    openDemoDocument(firstTab.store).catch((error: unknown) => {
      console.error('[Demo] Could not open the demo document:', error)
      toast.error(
        notificationMessages.get().openFileFailed({
          name: 'Demo',
          error: error instanceof Error ? error.message : String(error)
        })
      )
    })
  }
}

// A first visit to the demo link is a first run too; the welcome there skips the tour offer.
const welcomeShown =
  createdInitialTab && (route.path === '/' || route.meta.demo) && !appRuntimeConfig.test
    ? offerAISetupOnFirstRun({ inTour: route.meta.demo === true })
    : false
const sharingStarted = startSharing()
// One question per surface: a first run is asked about usage stats once the welcome closes.
if (welcomeShown) {
  whenever(
    () => !aiSetupDialogOpen.value,
    async () => {
      await sharingStarted
      offerUsageStatsPrompt('welcome')
    },
    { once: true }
  )
} else {
  // Asked once the window shows what it opened, not over the loading screen.
  whenever(
    () => !openingCloudLink.value,
    async () => {
      await sharingStarted
      offerUsageStatsPrompt('prompt')
    },
    { once: true, immediate: true }
  )
}

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useEditorMenu()
useDocumentDrop()

const collab = useCollab()
provide(COLLAB_KEY, collab)
exposeCollaborationActions(collab, joinRoomFromInput)
exposeAutomationTestRequests()
syncTabAddress(router, route)

useEventListener(
  document,
  'wheel',
  (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault()
  },
  { passive: false }
)

const fileAssociationCleanup = ref<(() => void) | null>(null)
const roomLinksCleanup = ref<(() => void) | null>(null)

/**
 * A drain that fails wholesale — the `take_pending_open` invoke, the event binding —
 * leaves the user staring at an app that ignored their double-click or their link.
 * Per-entry failures are already toasted inside `openPendingFiles`; this is the outer
 * net, and it must be visible, not console-only.
 */
function reportOpenFailure(error: unknown): void {
  console.error('[Open With]', error)
  toast.error(
    notificationMessages.get().openQueuedFilesFailed({
      error: error instanceof Error ? error.message : String(error)
    })
  )
}

function openDocumentPaths(): string[] {
  return getTabsSnapshot()
    .map((tab) => tab.store.getSourceIdentity().path)
    .filter((path): path is string => path !== null)
}

/**
 * Drops the link params through the router, not through `history` directly: the router
 * keeps its own copy of the current URL in `history.state` and re-applies it on the next
 * navigation, which would put `file` and `node` back into the entry. Route and hash are
 * preserved, so the link works on `/`, `/rooms/:id` and `/demo` alike.
 */
function stripWebLinkParams(): void {
  void router.replace({
    path: route.path,
    query: withoutWebLinkParams(route.query),
    hash: route.hash
  })
}

/** The action both link handlers take; see `focusNodesByName`. */
async function selectNodeByName(name: string): Promise<boolean> {
  // A search the user overtook by switching pages is not a missing layer.
  return (await focusNodesByName(getActiveStore(), name)) !== 'missing'
}

async function openPendingAssociatedFiles(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const files = await invoke<PendingOpenFile[]>('take_pending_open')
  await openPendingFiles(files, {
    openPaths: openDocumentPaths,
    selectByName: selectNodeByName,
    notify: toast.info
  })
}

// A deep link can block this drain on a modal file picker, so a second event must
// queue behind the first: overlapping drains would prompt twice for the same file.
let pendingOpenDrain: Promise<void> = Promise.resolve()

function drainPendingOpens(): Promise<void> {
  pendingOpenDrain = pendingOpenDrain.then(openPendingAssociatedFiles).catch(reportOpenFailure)
  return pendingOpenDrain
}

async function bindAssociatedFileOpen(): Promise<void> {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  fileAssociationCleanup.value = await listen('open-associated-files', () => {
    void drainPendingOpens()
  })
  await drainPendingOpens()
}

let stopWebMCP: (() => void) | undefined

onMounted(async () => {
  stopWebMCP = startWebMCP(getActiveStore)
  await startMCPRuntime(getActiveStore)

  try {
    await bindAssociatedFileOpen()
  } catch (error) {
    reportOpenFailure(error)
  }

  try {
    roomLinksCleanup.value = await bindDesktopRoomLinks((roomId) => {
      if (!joinRoomFromInput(roomId)) toast.error(collaboration.value.invalidRoomLink)
    })
  } catch (error) {
    console.error('[Room link]', error)
  }

  // The browser twin of the deep link: the desktop build takes its links through the
  // deep-link plugin above, so only a real browser reads them off the address bar.
  if (IS_BROWSER && !isTauri()) {
    try {
      await openWebLinkFromLocation(window.location.search, stripWebLinkParams, {
        selectByName: selectNodeByName,
        notify: (message, level) => (level === 'error' ? toast.error : toast.info)(message)
      })
    } catch (error) {
      console.error('[Web link]', error)
    }
  }
})

onUnmounted(() => {
  stopWebMCP?.()
  void stopMCPRuntime()
  fileAssociationCleanup.value?.()
  roomLinksCleanup.value?.()
})
</script>

<template>
  <div data-test-id="editor-root" class="flex h-screen w-screen flex-col">
    <FileApiBanner />
    <ColorSpaceBanner />
    <FontStatusBanner />
    <RenameSelectionDialog />
    <CommandPalette />
    <TabBar />
    <HomeWorkspace v-show="activeTab?.kind === 'home'" @new-document="createTab()" />
    <CloudVersionDialog />
    <EditorWorkspace v-if="shown && shown.tab.kind !== 'home'" :key="shown.key" :tab="shown.tab" />
    <LoadingScreen v-if="openingCloudLink" />
  </div>
</template>
