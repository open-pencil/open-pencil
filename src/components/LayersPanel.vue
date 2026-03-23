<script setup lang="ts">
import {
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'

import { useEditorStore } from '@/stores/editor'

import AppMenu from './AppMenu.vue'
import AssetsPanel from './AssetsPanel.vue'
import LayerTree from './LayerTree.vue'
import PagesPanel from './PagesPanel.vue'

const store = useEditorStore()
</script>

<template>
  <aside
    data-test-id="layers-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-panel"
    style="contain: paint layout style"
  >
    <AppMenu />
    <SplitterGroup direction="vertical" auto-save-id="layers-layout" class="flex-1 overflow-hidden">
      <SplitterPanel
        :default-size="30"
        :min-size="10"
        :max-size="60"
        class="flex flex-col overflow-hidden"
      >
        <PagesPanel />
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -my-1 h-2 cursor-row-resize">
        <div
          class="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
        />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="70" :min-size="20" class="flex flex-col overflow-hidden">
        <TabsRoot v-model="store.state.leftPanelTab" class="flex min-h-0 flex-1 flex-col">
          <TabsList data-test-id="layers-header" class="flex shrink-0 items-center gap-2 px-3 py-2">
            <TabsTrigger
              value="layers"
              class="text-[11px] tracking-wider text-muted uppercase hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
            >
              Layers
            </TabsTrigger>
            <TabsTrigger
              value="assets"
              class="text-[11px] tracking-wider text-muted uppercase hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
            >
              Assets
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="layers"
            class="flex min-h-0 flex-1 flex-col"
            :force-mount="true"
            :hidden="store.state.leftPanelTab !== 'layers'"
          >
            <LayerTree data-test-id="layers-tree" />
          </TabsContent>
          <TabsContent value="assets" class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AssetsPanel />
          </TabsContent>
        </TabsRoot>
      </SplitterPanel>
    </SplitterGroup>
  </aside>
</template>
