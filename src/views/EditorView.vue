<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref } from 'vue'
import { useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useViewportKind, formatShortcut, useI18n } from '@open-pencil/vue'
import { cloudActivityMessage } from '@/app/cloud/activity'
import { isCloudConfigured } from '@/app/cloud/credentials'
import { pendingSyncCount, syncStatusLabel, syncUiState } from '@/app/cloud/sync'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { loadEditorLayout, saveEditorLayout } from '@/app/shell/layout-storage'
import { useDesignFileDrop } from '@/app/shell/menu/design-file-drop'
import { openFileFromPath, useMenu } from '@/app/shell/menu/use'
import { useCollab, COLLAB_KEY } from '@/app/collab/use'
import { connectAutomation } from '@/app/automation/bridge/server'
import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'
import { isTauri } from '@/app/tauri/env'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { createDemoShapes } from '@/app/demo/document'
import { useEditorStore } from '@/app/editor/active-store'
import {
  createTab,
  activeTab,
  getActiveStore,
  openCloudCanvasInTab,
  refreshCloudThumbnail,
  tabCount
} from '@/app/tabs'

import CollabPanel from '@/components/CollabPanel/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import SettingsDialog from '@/components/Settings/SettingsDialog.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import TabBar from '@/components/TabBar.vue'
import Tip from '@/components/ui/Tip.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'

const route = useRoute()
const router = useRouter()
const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)

const createdInitialTab = tabCount() === 0
const firstTab = createdInitialTab ? createTab() : (activeTab.value ?? createTab())
const store = useEditorStore()
const { dialogs } = useI18n()
const { isMobile } = useViewportKind()

if (createdInitialTab && route.meta.demo && !('test' in params)) {
  createDemoShapes(firstTab.store)
}

const showSyncChip = computed(
  () =>
    syncUiState.value === 'syncing' ||
    syncUiState.value === 'offline' ||
    syncUiState.value === 'error'
)
const syncChipLabel = computed(() => {
  if (syncUiState.value === 'syncing') {
    const n = pendingSyncCount.value
    // "Syncing… (3)" — how many uploads/deletes remain in the outbox
    return n > 1 ? `${dialogs.value.cloudSyncSyncing} (${n})` : dialogs.value.cloudSyncSyncing
  }
  if (syncUiState.value === 'offline') return dialogs.value.cloudSyncOffline
  return syncStatusLabel.value ?? dialogs.value.cloudSyncError
})

async function goToFiles() {
  // Snapshot a fresh card preview while the canvas is still painted.
  // Use the ACTIVE tab's cloud binding — the route param may point at a
  // different tab's canvas after tab switches.
  const binding = getActiveStore().getCloudBinding?.()
  if (binding?.canvasId) {
    await refreshCloudThumbnail(binding.canvasId, store)
  }
  void router.push('/')
}

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useDesignFileDrop()
useMenu()

const collab = useCollab(getActiveStore)
provide(COLLAB_KEY, collab)

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)

const automationCleanup = ref<(() => void) | null>(null)
const mcpCleanup = ref<(() => void) | null>(null)
const fileAssociationCleanup = ref<(() => void) | null>(null)
const initialEditorLayout = loadEditorLayout()

type PendingOpenFile = {
  path: string
}

async function openPendingAssociatedFiles() {
  const { invoke } = await import('@tauri-apps/api/core')
  const files = await invoke<PendingOpenFile[]>('take_pending_open')
  for (const file of files) {
    await openFileFromPath(file.path)
  }
}

async function bindAssociatedFileOpen() {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  fileAssociationCleanup.value = await listen('open-associated-files', () => {
    void openPendingAssociatedFiles().catch((e) => console.error('[Open With]', e))
  })
  await openPendingAssociatedFiles()
}

onMounted(async () => {
  const canvasId = route.params.canvasId
  if (typeof canvasId === 'string' && canvasId) {
    const binding = getActiveStore().getCloudBinding?.()
    if (binding?.canvasId !== canvasId) {
      try {
        await openCloudCanvasInTab(canvasId)
      } catch (e) {
        console.error('[Cloud open]', e)
        // Missing/broken cloud canvas → back to the files list (or local editor when cloud is off)
        await router.replace(isCloudConfigured.value ? '/' : '/edit')
        return
      }
    }
  } else if (isCloudConfigured.value && route.name === 'edit' && route.query.local !== '1') {
    // Belt-and-suspenders if beforeEnter did not run (e.g. in-app navigation edge cases)
    await router.replace('/')
    return
  }

  try {
    const mcp = await spawnMCPIfNeeded()
    mcpCleanup.value = mcp?.disconnect ?? null
    const tauri = isTauri()
    if (import.meta.env.DEV || tauri) {
      automationCleanup.value = connectAutomation(getActiveStore, mcp?.authToken ?? null).disconnect
    }
  } catch (e) {
    console.warn('[MCP]', e)
  }

  try {
    await bindAssociatedFileOpen()
  } catch (e) {
    console.error('[Open With]', e)
  }
})

onUnmounted(() => {
  mcpCleanup.value?.()
  automationCleanup.value?.()
  fileAssociationCleanup.value?.()
})
</script>

<template>
  <div data-test-id="editor-root" class="flex h-screen w-screen flex-col">
    <SafariBanner />
    <div
      v-if="isCloudConfigured && showChrome"
      class="flex items-center justify-between gap-2 border-b border-border bg-panel px-2 py-1"
    >
      <button
        type="button"
        class="rounded px-2 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
        data-test-id="back-to-files"
        @click="goToFiles"
      >
        ← {{ dialogs.backToFiles }}
      </button>
      <div class="flex items-center gap-2">
        <span
          v-if="cloudActivityMessage"
          class="flex items-center gap-1.5 text-[11px] text-muted"
          data-test-id="cloud-activity-status"
        >
          <icon-lucide-cloud class="size-3.5 shrink-0 animate-pulse" />
          {{ cloudActivityMessage }}
        </span>
        <span
          v-else-if="showSyncChip"
          class="flex items-center gap-1.5 text-[11px] text-muted"
          data-test-id="cloud-sync-status"
        >
          <icon-lucide-cloud-off
            v-if="syncUiState === 'offline' || syncUiState === 'error'"
            class="size-3.5 shrink-0 opacity-80"
          />
          <icon-lucide-cloud-upload v-else class="size-3.5 shrink-0 animate-pulse opacity-80" />
          {{ syncChipLabel }}
        </span>
        <SettingsDialog />
      </div>
    </div>
    <TabBar />

    <!-- Desktop layout -->
    <SplitterGroup
      v-if="!isMobile && showChrome && store.state.showUI"
      :key="activeTab?.id"
      direction="horizontal"
      class="flex-1 overflow-hidden"
      @layout="saveEditorLayout"
    >
      <SplitterPanel
        id="layers"
        :default-size="initialEditorLayout[0]"
        :min-size="10"
        :max-size="30"
        class="flex"
      >
        <LayersPanel />
      </SplitterPanel>
      <SplitterResizeHandle
        data-test-id="left-splitter-handle"
        class="group relative z-10 -mx-1 w-2 cursor-col-resize"
      >
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel id="canvas" :default-size="initialEditorLayout[1]" :min-size="30" class="flex">
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <Toolbar />
        </div>
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel
        id="properties"
        :default-size="initialEditorLayout[2]"
        :min-size="10"
        :max-size="30"
        class="flex flex-col"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5"
        >
          <CollabPanel />
        </div>
        <PropertiesPanel />
      </SplitterPanel>
    </SplitterGroup>

    <!-- Mobile layout -->
    <div
      v-else-if="isMobile && showChrome && store.state.showUI"
      :key="'mobile-' + activeTab?.id"
      class="flex flex-1 overflow-hidden"
    >
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
        <MobileHud />
        <Toolbar />
      </div>
      <MobileDrawer />
    </div>

    <!-- Collapsed UI (showUI=false) -->
    <div
      v-else-if="showChrome"
      :key="'collapsed-' + activeTab?.id"
      class="flex flex-1 overflow-hidden"
    >
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
        <div
          v-if="!isMobile"
          class="absolute top-7 left-7 z-10 flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1 shadow-sm"
        >
          <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
          <span data-test-id="editor-document-name" class="text-xs text-surface">{{
            store.state.documentName
          }}</span>
          <Tip
            :label="
              dialogs.showUI({ shortcut: formatShortcut(appMenuShortcut('toggle-ui')) ?? '' })
            "
          >
            <button
              data-test-id="editor-show-ui"
              class="ml-1 flex size-6 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="store.state.showUI = true"
            >
              <icon-lucide-sidebar class="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>
    </div>

    <!-- Bare canvas (no chrome, e.g. ?no-chrome) -->
    <div v-else :key="'bare-' + activeTab?.id" class="flex flex-1 overflow-hidden">
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
      </div>
    </div>
  </div>
</template>
