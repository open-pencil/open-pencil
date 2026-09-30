<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useDesignCheckMessages, useI18n } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { useEditorStore } from '@/app/editor/active-store'
import { countIssues } from '@/app/editor/design-check/issues'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignCheckPanel from './design-check/DesignCheckPanel.vue'
import DesignPanel from './DesignPanel.vue'
import ZoomDropdown from './editor/ZoomDropdown.vue'
import Tip from './ui/overlay/Tip.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()
const checkMessages = useDesignCheckMessages()
const store = useEditorStore()

/** Errors and warnings on the current page; suggestions do not earn a badge. */
const problemCount = computed(() => {
  const snapshot = store.designCheck.snapshot.value
  if (!snapshot || snapshot.pageId !== store.state.currentPageId) return null
  const counts = countIssues(snapshot.issues)
  return { total: counts.error + counts.warning, severity: counts.error > 0 ? 'error' : 'warning' }
})
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <!-- Narrow panels keep the Code and AI icons and move their labels to screen readers. -->
      <TabsList
        class="@container/tabs flex h-10 shrink-0 items-center gap-1 border-b border-border px-2"
      >
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          class="relative rounded px-2.5 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface after:absolute after:inset-x-2 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent"
        >
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger
          value="code"
          data-test-id="properties-tab-code"
          class="relative flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface after:absolute after:inset-x-2 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent"
        >
          <icon-lucide-code class="size-3" aria-hidden="true" />
          <span class="sr-only @[16.5rem]/tabs:not-sr-only">{{ panels.code }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="ai"
          data-test-id="properties-tab-ai"
          class="relative flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface after:absolute after:inset-x-2 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent"
        >
          <icon-lucide-sparkles class="size-3" aria-hidden="true" />
          <span class="sr-only @[16.5rem]/tabs:not-sr-only">{{ panels.ai }}</span>
        </TabsTrigger>
        <Tip :label="checkMessages.tab" side="bottom">
          <TabsTrigger
            value="check"
            data-test-id="properties-tab-check"
            :aria-label="
              problemCount?.total
                ? `${checkMessages.tab}, ${checkMessages.tabCount({ count: problemCount.total })}`
                : checkMessages.tab
            "
            class="relative flex items-center rounded px-1.5 py-1 text-muted hover:text-surface data-[state=active]:text-surface after:absolute after:inset-x-1 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent"
          >
            <icon-lucide-list-checks class="size-3.5" aria-hidden="true" />
            <span
              v-if="problemCount?.total"
              :data-severity="problemCount.severity"
              aria-hidden="true"
              class="absolute -top-0.5 left-[15px] min-w-3.5 rounded-full px-[3px] text-center text-[9px] leading-3.5 font-semibold tabular-nums ring-2 ring-panel data-[severity=error]:bg-issue-error data-[severity=error]:text-white data-[severity=warning]:bg-issue-warning data-[severity=warning]:text-black/85"
            >
              {{ problemCount.total > 99 ? '99+' : problemCount.total }}
            </span>
          </TabsTrigger>
        </Tip>
        <ZoomDropdown v-if="activeTab === 'design'" />
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
        <CodePanel :active="activeTab === 'code'" />
      </TabsContent>

      <TabsContent
        value="check"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'check'"
      >
        <DesignCheckPanel :active="activeTab === 'check'" />
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
