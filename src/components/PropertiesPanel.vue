<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { useAIChat } from '@/composables/use-chat'
import { useEditorStore } from '@/stores/editor'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'

const store = useEditorStore()
const { activeTab } = useAIChat()
const { t } = useI18n()
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          class="rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ t('panels.design') }}
        </TabsTrigger>
        <TabsTrigger
          value="code"
          data-test-id="properties-tab-code"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-code class="size-3" />
          {{ t('panels.code') }}
        </TabsTrigger>
        <TabsTrigger
          value="ai"
          data-test-id="properties-tab-ai"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-sparkles class="size-3" />
          {{ t('panels.ai') }}
        </TabsTrigger>
        <span
          v-if="activeTab === 'design'"
          data-test-id="properties-zoom"
          class="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover"
        >
          {{ Math.round(store.state.zoom * 100) }}%
        </span>
      </TabsList>

      <TabsContent
        value="design"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'design'"
      >
        <DesignPanel />
      </TabsContent>

      <TabsContent
        value="code"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'code'"
      >
        <CodePanel />
      </TabsContent>

      <TabsContent
        value="ai"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'ai'"
      >
        <ChatPanel />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>
