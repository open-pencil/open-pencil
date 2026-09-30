<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { startMCPRuntime, stopMCPRuntime } from '@/app/automation/mcp/runtime'
import { startWebMCP } from '@/app/automation/webmcp/runtime'
import { exposeCollaborationActions } from '@/app/browser-bridge'
import { COLLAB_KEY, useCollab } from '@/app/collab/use'
import { createDemoShapes } from '@/app/demo/document'
import type { PendingOpenFile } from '@/app/document/io/pending-open'
import { openPendingFiles } from '@/app/document/io/pending-open'
import { openWebLinkFromLocation, withoutWebLinkParams } from '@/app/document/io/web-link'
import { focusNodesByName } from '@/app/editor/selection/focus'
import { notificationMessages } from '@/app/i18n/notifications'
import { appRuntimeConfig } from '@/app/runtime/config'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { useEditorMenu } from '@/app/shell/menu/use'
import { toast } from '@/app/shell/ui'
import {
  activeTab,
  createDocumentInCurrentTab,
  createHomeTab,
  createTab,
  getActiveStore,
  getTabsSnapshot,
  tabCount
} from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'
import ColorSpaceBanner from '@/components/canvas/ColorSpaceBanner.vue'
import CommandPalette from '@/components/commands/CommandPalette.vue'
import EditorWorkspace from '@/components/editor/EditorWorkspace.vue'
import FileApiBanner from '@/components/FileApiBanner.vue'
import FontStatusBanner from '@/components/font-status/FontStatusBanner.vue'
import HomeWorkspace from '@/components/home/HomeWorkspace.vue'
import RenameSelectionDialog from '@/components/selection/RenameSelectionDialog.vue'
import TabBar from '@/components/TabBar.vue'
import { IS_BROWSER } from '@/constants'

const route = useRoute()
const router = useRouter()
const createdInitialTab = tabCount() === 0
const shouldCreateHome =
  route.path === '/' &&
  !appRuntimeConfig.test &&
  !route.meta.demo &&
  (isTauri() || appRuntimeConfig.recentFiles)
let firstTab = activeTab.value
if (!firstTab) firstTab = shouldCreateHome ? createHomeTab() : createTab()

if (createdInitialTab && route.meta.demo && !appRuntimeConfig.test) {
  void createDemoShapes(firstTab.store)
}

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useEditorMenu()

const collab = useCollab(getActiveStore)
provide(COLLAB_KEY, collab)
exposeCollaborationActions(collab)

useEventListener(
  document,
  'wheel',
  (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault()
  },
  { passive: false }
)

const fileAssociationCleanup = ref<(() => void) | null>(null)

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
 * preserved, so the link works on `/`, `/share/:id` and `/demo` alike.
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
    <HomeWorkspace v-show="activeTab?.kind === 'home'" @new-document="createDocumentInCurrentTab" />
    <EditorWorkspace v-if="activeTab?.kind !== 'home'" />
  </div>
</template>
