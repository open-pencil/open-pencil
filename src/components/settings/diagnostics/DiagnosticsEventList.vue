<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { summarizeDiagnosticEvent, type DiagnosticCategory } from '@/app/diagnostics'
import { useRecentDiagnostics } from '@/app/diagnostics/settings/recent'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

const { refreshStats } = defineProps<{ refreshStats: () => Promise<void> }>()
const { diagnostics: messages } = useI18n()

const { visible, total, hasMore, showMore, level, category, categories } = useRecentDiagnostics(
  (event) => summarizeDiagnosticEvent(event, messages.value),
  refreshStats
)

const levelOptions = computed(() => [
  { value: 'all', label: messages.value.filterAll },
  { value: 'problems', label: messages.value.filterProblems }
])
const levelModel = computed({
  get: () => level.value,
  set: (value: string) => {
    level.value = value === 'problems' ? 'problems' : 'all'
  }
})

const CATEGORY_LABELS: Record<DiagnosticCategory, keyof typeof messages.value> = {
  ai: 'categoryAI',
  document: 'categoryDocument',
  renderer: 'categoryRenderer',
  storage: 'categoryStorage',
  sync: 'categorySync',
  mcp: 'categoryMCP',
  recovery: 'categoryRecovery',
  performance: 'categoryPerformance',
  runtime: 'categoryRuntime'
}

function categoryLabel(name: DiagnosticCategory): string {
  const label = messages.value[CATEGORY_LABELS[name]]
  return typeof label === 'string' ? label : name
}

const categoryOptions = computed(() => [
  { value: 'all' as const, label: messages.value.allCategories },
  ...categories.value.map((name) => ({ value: name, label: categoryLabel(name) }))
])
</script>

<template>
  <div class="space-y-2" data-slot="diagnostics-events">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <SegmentedControl
        v-model="levelModel"
        :options="levelOptions"
        :label="messages.filterLevel"
        size="sm"
      />
      <AppSelect
        v-model="category"
        :options="categoryOptions"
        :label="messages.filterCategory"
        :ui="{ trigger: 'w-40' }"
      />
    </div>
    <SettingsGroup v-if="visible.length">
      <CollapsibleRoot v-for="event in visible" :key="event.id" data-slot="diagnostics-event">
        <CollapsibleTrigger
          class="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-[11px] hover:bg-hover"
        >
          <span class="flex min-w-0 items-center gap-2">
            <icon-lucide-circle-alert
              v-if="event.level === 'error'"
              class="size-3.5 shrink-0 text-error"
            />
            <icon-lucide-triangle-alert
              v-else-if="event.level === 'warning'"
              class="size-3.5 shrink-0 text-warning"
            />
            <icon-lucide-info v-else class="size-3.5 shrink-0 text-muted" />
            <span class="min-w-0">
              <span class="block truncate text-surface">{{ event.label }}</span>
              <span v-if="event.detail" class="block truncate text-[10px] text-muted">{{
                event.detail
              }}</span>
            </span>
          </span>
          <span class="shrink-0 text-muted">{{
            new Date(event.timestamp).toLocaleTimeString()
          }}</span>
        </CollapsibleTrigger>
        <CollapsibleContent :class="collapsibleContentMotion">
          <div class="space-y-1.5 px-3 pb-2.5 pl-8.5 font-mono text-[10px] text-muted">
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <template v-for="[name, value] in event.fields" :key="name">
                <dt>{{ name }}</dt>
                <dd class="min-w-0 break-words text-surface">{{ value }}</dd>
              </template>
            </dl>
            <pre
              v-if="event.stack"
              class="scrollbar-thin max-h-48 overflow-auto rounded border border-border bg-input p-2 whitespace-pre"
              >{{ event.stack }}</pre>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </SettingsGroup>
    <p v-else class="px-1 text-[11px] text-muted">{{ messages.noMatchingEvents }}</p>
    <div v-if="hasMore" class="flex items-center justify-between text-[11px] text-muted">
      <span>{{ messages.showingEvents({ shown: visible.length, total }) }}</span>
      <AppButton size="xs" color="neutral" variant="ghost" @click="showMore">{{
        messages.showMore
      }}</AppButton>
    </div>
  </div>
</template>
