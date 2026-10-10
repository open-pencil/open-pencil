<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useDesignCheckMessages, useI18n } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { useEditorStore } from '@/app/editor/active-store'
import { countIssues } from '@/app/editor/design-check/issues'
import { propertiesTabs } from '@/theme/panel/properties-tabs'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import CommentsPanel from './comments/CommentsPanel.vue'
import DesignCheckPanel from './design-check/DesignCheckPanel.vue'
import DesignPanel from './DesignPanel.vue'
import ZoomDropdown from './editor/ZoomDropdown.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()
const checkMessages = useDesignCheckMessages()
const store = useEditorStore()

const tabStyles = propertiesTabs()
/** The Comment tool turns the sidebar into the comments list, as in Figma; the tabs keep their state. */
const commenting = computed(() => store.state.activeTool === 'COMMENT')

/** Errors and warnings on the current page; suggestions do not earn an indicator. */
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
    <CommentsPanel v-if="commenting" />
    <TabsRoot v-show="!commenting" v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList :class="tabStyles.list()">
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          :class="tabStyles.trigger()"
        >
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger value="code" data-test-id="properties-tab-code" :class="tabStyles.trigger()">
          <icon-lucide-code :class="tabStyles.icon()" aria-hidden="true" />
          <span :class="tabStyles.label()">{{ panels.code }}</span>
        </TabsTrigger>
        <TabsTrigger value="ai" data-test-id="properties-tab-ai" :class="tabStyles.trigger()">
          <icon-lucide-sparkles :class="tabStyles.icon()" aria-hidden="true" />
          <span :class="tabStyles.label()">{{ panels.ai }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="lint"
          data-test-id="properties-tab-lint"
          :aria-label="
            problemCount?.total
              ? `${checkMessages.tab}, ${checkMessages.tabCount({ count: problemCount.total })}`
              : checkMessages.tab
          "
          :class="tabStyles.trigger()"
        >
          <!-- Errors and warnings tint the icon, which costs no room in a full row. -->
          <icon-lucide-list-checks
            :data-severity="problemCount?.total ? problemCount.severity : undefined"
            :class="tabStyles.icon()"
            aria-hidden="true"
          />
          <span :class="tabStyles.label()">{{ checkMessages.tab }}</span>
        </TabsTrigger>
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
        value="lint"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'lint'"
      >
        <DesignCheckPanel :active="activeTab === 'lint'" />
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
