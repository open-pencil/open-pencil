<script setup lang="ts">
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import DocumentHeader from '@/components/shell/DocumentHeader.vue'
import NavigationRail, { type LeftPanelView } from '@/components/shell/NavigationRail.vue'
import splitterTheme from '@/theme/splitter'

import AssetsPanel from './assets-panel/AssetsPanel.vue'
import LayerTree from './LayerTree/LayerTree.vue'
import PagesPanel from './PagesPanel.vue'

const { panels } = useI18n()
const activePanel = ref<LeftPanelView>('file')
const splitterStyles = tv(splitterTheme)({ direction: 'vertical' })
</script>

<template>
  <aside
    data-test-id="layers-panel"
    class="flex min-w-0 flex-1 overflow-hidden border-r border-border bg-panel"
    style="contain: paint layout style"
  >
    <NavigationRail v-model="activePanel" />
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <DocumentHeader />
      <AssetsPanel v-if="activePanel === 'assets'" />
      <SplitterGroup
        v-else
        direction="vertical"
        auto-save-id="layers-layout"
        class="flex-1 overflow-hidden"
      >
        <SplitterPanel
          :default-size="30"
          :min-size="10"
          :max-size="60"
          class="flex flex-col overflow-hidden"
        >
          <PagesPanel />
        </SplitterPanel>
        <SplitterResizeHandle :class="splitterStyles.handle()">
          <div :class="splitterStyles.divider()" />
        </SplitterResizeHandle>
        <SplitterPanel :default-size="70" :min-size="20" class="flex flex-col overflow-hidden">
          <header
            data-test-id="layers-header"
            class="shrink-0 px-3 py-2 text-[11px] font-semibold text-surface"
          >
            {{ panels.layers }}
          </header>
          <LayerTree data-test-id="layers-tree" />
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </aside>
</template>
