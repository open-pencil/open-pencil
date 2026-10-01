<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import { turnOffDesignCheckRule } from '@/app/settings/preferences/apply'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { designCheck } from '@/theme/design-check'

import DesignCheckRulesMenu from './DesignCheckRulesMenu.vue'
import IssueGroup from './IssueGroup.vue'
import SeverityFilters from './SeverityFilters.vue'
import { useDesignCheckPanel, type DesignCheckScope } from './useDesignCheckPanel'

const { active } = defineProps<{ active: boolean }>()

const messages = useDesignCheckMessages()
const styles = designCheck()
const list = useTemplateRef<HTMLElement>('list')

const {
  check,
  scope,
  visibleSeverities,
  counts,
  groups,
  emptyState,
  documentNote,
  loading,
  isGroupOpen,
  setGroupOpen,
  clearFilters,
  hoverRow
} = useDesignCheckPanel({ active: () => active, list })

const scopeOptions = computed(() => [
  { value: 'page' satisfies DesignCheckScope, label: messages.value.scopePage },
  { value: 'selection' satisfies DesignCheckScope, label: messages.value.scopeSelection },
  { value: 'document' satisfies DesignCheckScope, label: messages.value.scopeDocument }
])

const scopeModel = computed({
  get: () => scope.value,
  set: (value: string) => {
    if (value === 'page' || value === 'selection' || value === 'document') scope.value = value
  }
})
</script>

<template>
  <section data-test-id="design-check-panel" :aria-label="messages.tab" :class="styles.root()">
    <div :class="styles.toolbar()">
      <SegmentedControl v-model="scopeModel" :label="messages.scope" :options="scopeOptions" />
      <div :class="styles.toolbarRow()">
        <SeverityFilters v-model="visibleSeverities" :counts="counts" />
        <DesignCheckRulesMenu />
      </div>
    </div>

    <p v-if="documentNote" :class="styles.status()" data-test-id="design-check-document-note">
      {{ documentNote }}
    </p>
    <p v-if="loading" :class="styles.status()" role="status">{{ messages.checking }}</p>

    <AppPlaceholder
      v-else-if="emptyState"
      :label="emptyState.label"
      :description="emptyState.kind === 'filtered' ? undefined : emptyState.description"
      :fill="false"
      :ui="{ root: 'pt-10' }"
      data-test-id="design-check-empty"
    >
      <template #icon>
        <icon-lucide-circle-check v-if="emptyState.kind === 'clean'" class="size-4 text-success" />
        <icon-lucide-list-filter v-else-if="emptyState.kind === 'filtered'" class="size-4" />
        <icon-lucide-mouse-pointer-2 v-else class="size-4" />
      </template>
      <template v-if="emptyState.kind === 'filtered'" #action>
        <AppButton color="primary" size="xs" @click="clearFilters">
          {{ messages.clearFilters }}
        </AppButton>
      </template>
    </AppPlaceholder>

    <div v-else ref="list" :class="styles.list()" @mouseleave="hoverRow(null)">
      <IssueGroup
        v-for="group in groups"
        :key="group.ruleId"
        :group="group"
        :open="isGroupOpen(group)"
        @update:open="(open) => setGroupOpen(group.ruleId, open)"
        @open-row="(row) => void check.openIssue(row.issue)"
        @hover-row="hoverRow"
        @fix="(row) => row.action && check.applyFixes([row.action.request])"
        @fix-all="check.applyFixes(group.fixes)"
        @turn-off="turnOffDesignCheckRule(group.ruleId)"
      />
    </div>
  </section>
</template>
