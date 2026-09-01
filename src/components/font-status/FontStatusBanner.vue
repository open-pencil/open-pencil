<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useDocumentFontStatus } from '@/app/editor/fonts/status'

const { fonts } = useI18n()
const expanded = ref(false)
const { status, retrying, retry, selectAffectedNodes } = useDocumentFontStatus()
const issues = computed(() => status.value.issues)
</script>

<template>
  <div
    v-if="issues.length > 0"
    data-test-id="font-status-banner"
    class="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-xs text-[var(--color-warning-text)]"
  >
    <div class="flex items-center gap-2 px-3 py-1.5">
      <icon-lucide-triangle-alert class="size-3.5 shrink-0" />
      <button
        type="button"
        data-test-id="font-status-toggle"
        class="min-w-0 flex-1 text-left font-medium"
        @click="expanded = !expanded"
      >
        {{ issues.length === 1 ? fonts.issueFound : fonts.issuesFound({ count: issues.length }) }}
      </button>
      <button
        type="button"
        data-test-id="font-status-select"
        class="shrink-0 rounded px-1.5 py-0.5 font-medium text-[var(--color-warning-action)] transition-colors hover:bg-amber-500/20"
        @click="selectAffectedNodes"
      >
        {{ fonts.selectAffectedLayers }}
      </button>
      <button
        type="button"
        data-test-id="font-status-retry"
        class="shrink-0 rounded px-1.5 py-0.5 font-medium text-[var(--color-warning-action)] transition-colors hover:bg-amber-500/20 disabled:opacity-50"
        :disabled="retrying"
        @click="retry"
      >
        {{ retrying ? fonts.retrying : fonts.retry }}
      </button>
      <button
        type="button"
        :aria-label="expanded ? fonts.collapseIssues : fonts.expandIssues"
        class="flex size-5 shrink-0 items-center justify-center rounded hover:bg-amber-500/20"
        @click="expanded = !expanded"
      >
        <icon-lucide-chevron-up v-if="expanded" class="size-3.5" />
        <icon-lucide-chevron-down v-else class="size-3.5" />
      </button>
    </div>

    <div v-if="expanded" class="grid gap-1 border-t border-[var(--color-warning-border)] px-3 py-2">
      <div
        v-for="issue in issues"
        :key="`${issue.family}:${issue.style}`"
        data-test-id="font-status-issue"
        class="flex min-w-0 items-center gap-2"
      >
        <span class="min-w-0 flex-1 truncate">
          <strong>{{ issue.family }} {{ issue.style }}</strong>
          <template v-if="issue.substituteFamily"> → {{ issue.substituteFamily }} </template>
          <template v-else>— {{ fonts.noSubstitute }}</template>
        </span>
        <span class="shrink-0 text-[10px] opacity-75">
          {{
            issue.nodeIds.length === 1
              ? fonts.affectedLayer
              : fonts.affectedLayerCount({ count: issue.nodeIds.length })
          }}
        </span>
      </div>
    </div>
  </div>
</template>
