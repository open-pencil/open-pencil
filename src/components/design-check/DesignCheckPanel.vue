<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import { DESIGN_ISSUE_SEVERITIES, type DesignIssueSeverity } from '@/app/editor/design-check/issues'
import { setDesignIssuesOnCanvas } from '@/app/settings/preferences/apply'
import {
  appPreferences,
  DESIGN_CHECK_PRESETS,
  updateDesignCheckPreferences,
  type DesignCheckPreset
} from '@/app/settings/preferences/store'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { designCheck } from '@/theme/design-check'

import IssueGroup from './IssueGroup.vue'
import SeverityIcon from './SeverityIcon.vue'
import type { IssueRowView } from './types'
import { useDesignCheckPanel, type DesignCheckScope } from './useDesignCheckPanel'

const { active } = defineProps<{ active: boolean }>()

const messages = useDesignCheckMessages()
const styles = designCheck()
const menuCls = useMenuUI({ content: 'min-w-56' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })
const labelCls = 'px-2 pt-1.5 pb-1 text-[11px] text-muted'
const listRef = useTemplateRef<HTMLElement>('list')

const {
  check,
  scope,
  filters,
  hasSelection,
  counts,
  groups,
  filtersActive,
  loading,
  isGroupOpen,
  setGroupOpen,
  toggleFilter,
  clearFilters,
  revealIssueRow,
  applyFixes
} = useDesignCheckPanel()

const preferences = computed(() => appPreferences.value.designCheck)

const presetLabels = computed<Record<DesignCheckPreset, string>>(() => ({
  recommended: messages.value.presetRecommended,
  strict: messages.value.presetStrict,
  accessibility: messages.value.presetAccessibility
}))

const severityLabels = computed<Record<DesignIssueSeverity, string>>(() => ({
  error: messages.value.errors,
  warning: messages.value.warnings,
  info: messages.value.suggestions
}))

const scopeOptions = computed(() => [
  { value: 'page', label: messages.value.scopePage },
  { value: 'selection', label: messages.value.scopeSelection }
])

const scopeModel = computed({
  get: () => scope.value,
  set: (value: string) => {
    scope.value = value as DesignCheckScope
  }
})

const presetModel = computed({
  get: () => preferences.value.preset,
  set: (value: string) => {
    const preset = DESIGN_CHECK_PRESETS.find((candidate) => candidate === value)
    if (preset) updateDesignCheckPreferences({ preset })
  }
})

const emptyState = computed(() => {
  if (loading.value) return null
  if (scope.value === 'selection' && !hasSelection.value) {
    return { label: messages.value.noSelection, description: messages.value.noSelectionDescription }
  }
  if (groups.value.length > 0) return null
  if (filtersActive.value && counts.value.error + counts.value.warning + counts.value.info > 0) {
    return { label: messages.value.noFilteredIssues, description: undefined, clear: true }
  }
  return {
    label: scope.value === 'page' ? messages.value.emptyPage : messages.value.emptySelection,
    description: messages.value.emptyDescription({
      preset: presetLabels.value[preferences.value.preset]
    }),
    clean: true
  }
})

function setShowOnCanvas(showOnCanvas: boolean) {
  setDesignIssuesOnCanvas(showOnCanvas)
}

function turnOffRule(ruleId: string) {
  const disabledRules = new Set(preferences.value.disabledRules)
  disabledRules.add(ruleId)
  updateDesignCheckPreferences({ disabledRules: [...disabledRules] })
}

function turnOnRules() {
  updateDesignCheckPreferences({ disabledRules: [] })
}

function hoverRow(row: IssueRowView | null) {
  check.highlightIssue(row && !row.missing ? row.issue : null)
}

function openRow(row: IssueRowView) {
  check.openIssue(row.issue)
}

watch(
  () => active,
  (visible) => {
    check.panelVisible.value = visible
    if (!visible) check.highlightIssue(null)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  check.panelVisible.value = false
  check.highlightIssue(null)
})

/** Brings the focused issue's row into view, e.g. after a canvas marker click. */
watch(
  [check.focusedIssueId, groups],
  async ([issueId], [previousId]) => {
    if (!issueId || issueId === previousId) return
    const issue = check.snapshot.value?.issues.find((candidate) => candidate.id === issueId)
    if (!issue) return
    revealIssueRow(issue)
    await nextTick()
    const row = listRef.value?.querySelector<HTMLElement>(
      `[data-issue-id="${CSS.escape(issueId)}"]`
    )
    row?.scrollIntoView({ block: 'center' })
  },
  { flush: 'post' }
)
</script>

<template>
  <section data-test-id="design-check-panel" :aria-label="messages.tab" :class="styles.root()">
    <div :class="styles.toolbar()">
      <SegmentedControl v-model="scopeModel" :label="messages.scope" :options="scopeOptions" />
      <div :class="styles.toolbarRow()">
        <div :class="styles.filters()">
          <Tip
            v-for="severity in DESIGN_ISSUE_SEVERITIES"
            :key="severity"
            as-child
            :label="messages.filterBySeverity({ severity: severityLabels[severity] })"
          >
            <button
              type="button"
              :class="styles.filter()"
              :data-severity="severity"
              :data-state="filters[severity] ? 'on' : 'off'"
              :aria-pressed="filters[severity]"
              :aria-label="`${severityLabels[severity]}: ${counts[severity]}`"
              @click="toggleFilter(severity)"
            >
              <SeverityIcon :severity="severity" />
              {{ counts[severity] }}
            </button>
          </Tip>
        </div>
        <DropdownMenuRoot :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton size="xs" :label="messages.rules">
              <icon-lucide-settings-2 class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="bottom"
              align="end"
              :side-offset="4"
              :class="menuCls.content"
            >
              <DropdownMenuLabel :class="labelCls">{{ messages.rules }}</DropdownMenuLabel>
              <DropdownMenuRadioGroup v-model="presetModel">
                <DropdownMenuRadioItem
                  v-for="preset in DESIGN_CHECK_PRESETS"
                  :key="preset"
                  :value="preset"
                  :class="itemCls"
                >
                  <DropdownMenuItemIndicator class="absolute left-2">
                    <icon-lucide-check class="size-3.5" />
                  </DropdownMenuItemIndicator>
                  {{ presetLabels[preset] }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <template v-if="preferences.disabledRules.length > 0">
                <DropdownMenuSeparator :class="menuCls.separator" />
                <DropdownMenuItem :class="itemCls" @select="turnOnRules">
                  {{ messages.turnOnRules({ count: preferences.disabledRules.length }) }}
                </DropdownMenuItem>
              </template>
              <DropdownMenuSeparator :class="menuCls.separator" />
              <DropdownMenuCheckboxItem
                :model-value="preferences.showOnCanvas"
                :class="itemCls"
                @update:model-value="setShowOnCanvas"
              >
                <DropdownMenuItemIndicator class="absolute left-2">
                  <icon-lucide-check class="size-3.5" />
                </DropdownMenuItemIndicator>
                {{ messages.showOnCanvas }}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>

    <p v-if="loading" :class="styles.status()" role="status">{{ messages.checking }}</p>

    <AppPlaceholder
      v-else-if="emptyState"
      :label="emptyState.label"
      :description="emptyState.description"
      :fill="false"
      :ui="{ root: 'pt-10' }"
      data-test-id="design-check-empty"
    >
      <template #icon>
        <icon-lucide-circle-check v-if="emptyState.clean" class="size-4 text-success" />
        <icon-lucide-list-filter v-else-if="emptyState.clear" class="size-4" />
        <icon-lucide-mouse-pointer-2 v-else class="size-4" />
      </template>
      <template v-if="emptyState.clear" #action>
        <button type="button" :class="styles.textAction()" @click="clearFilters">
          {{ messages.clearFilters }}
        </button>
      </template>
    </AppPlaceholder>

    <div v-else ref="list" :class="styles.list()" @mouseleave="hoverRow(null)">
      <IssueGroup
        v-for="group in groups"
        :key="group.ruleId"
        :group="group"
        :open="isGroupOpen(group)"
        @update:open="(open) => setGroupOpen(group.ruleId, open)"
        @open-row="openRow"
        @hover-row="hoverRow"
        @fix="(row) => row.fix && applyFixes([row.fix])"
        @fix-all="applyFixes(group.fixes)"
        @turn-off="turnOffRule(group.ruleId)"
      />
    </div>
  </section>
</template>
