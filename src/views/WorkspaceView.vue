<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'

import { startMCPRuntime, stopMCPRuntime } from '@/app/automation/mcp/runtime'
import { startWebMCP } from '@/app/automation/webmcp/runtime'
import { exposeCollaborationActions } from '@/app/browser-bridge'
import { COLLAB_KEY, useCollab } from '@/app/collab/use'
import { createDemoShapes } from '@/app/demo/document'
import { appRuntimeConfig } from '@/app/runtime/config'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { openFileFromPath, useEditorMenu } from '@/app/shell/menu/use'
import {
  activeTab,
  createDocumentInCurrentTab,
  createHomeTab,
  createTab,
  getActiveStore,
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

const route = useRoute()
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

interface PendingOpenFile {
  path: string
}

async function openPendingAssociatedFiles(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const files = await invoke<PendingOpenFile[]>('take_pending_open')
  for (const file of files) await openFileFromPath(file.path)
}

async function bindAssociatedFileOpen(): Promise<void> {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  fileAssociationCleanup.value = await listen('open-associated-files', () => {
    void openPendingAssociatedFiles().catch((error) => console.error('[Open With]', error))
  })
  await openPendingAssociatedFiles()
}

let stopWebMCP: (() => void) | undefined

onMounted(async () => {
  stopWebMCP = startWebMCP(getActiveStore)
  await startMCPRuntime(getActiveStore)

  try {
    await bindAssociatedFileOpen()
  } catch (error) {
    console.error('[Open With]', error)
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
