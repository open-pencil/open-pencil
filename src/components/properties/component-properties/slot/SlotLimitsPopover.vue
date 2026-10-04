<script setup lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useI18n, useRetainedPopup } from '@open-pencil/vue'
import type { SlotLimit } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'

const { limits } = defineProps<{ limits: SlotLimit[] }>()
const emit = defineEmits<{ selectLayers: [] }>()
const { panels, common } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()
const issues = computed(() => limits.filter((limit) => !limit.met).length)
const styles = usePopoverUI({
  content: 'w-64 max-w-[calc(100vw-1rem)]',
  header: 'flex items-center gap-1.5 border-b border-border px-3 py-2',
  body: 'flex flex-col gap-2.5 p-3'
})

function label(limit: SlotLimit): string {
  if (limit.kind === 'minimum') return panels.value.slotMinimumLayers(limit.count)
  if (limit.kind === 'maximum') return panels.value.slotMaximumLayers(limit.count)
  return panels.value.slotPreferredOnly
}
</script>

<template>
  <PopoverRoot v-model:open="popupOpen">
    <PopoverTrigger
      :data-issues="issues > 0 || undefined"
      data-property="slot-limits"
      class="flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded bg-panel-field px-1.5 text-[10px] text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-issues:bg-issue-warning/15 data-issues:text-issue-warning"
    >
      <SeverityIcon v-if="issues" severity="warning" />
      <icon-lucide-check v-else class="size-3 text-success" />
      {{ panels.slotLimitCount(limits.length) }}
    </PopoverTrigger>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :aria-label="panels.slotLimits"
        :class="styles.content"
      >
        <div :class="styles.header">
          <h3 class="text-xs font-semibold text-surface">{{ panels.slotLimits }}</h3>
          <span v-if="issues" class="text-[11px] text-muted">
            {{ panels.slotLimitIssueCount(issues) }}
          </span>
          <PopoverClose as-child>
            <AppButton :aria-label="common.close" class="ml-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <ul :class="styles.body">
          <li
            v-for="limit in limits"
            :key="limit.kind"
            class="grid grid-cols-[14px_minmax(0,1fr)] gap-x-2 text-xs text-surface"
          >
            <icon-lucide-check v-if="limit.met" class="mt-px size-3.5 text-success" />
            <SeverityIcon v-else severity="warning" class="mt-px size-3.5" />
            <span>{{ label(limit) }}</span>
            <template v-if="limit.kind === 'preferred' && !limit.met">
              <span />
              <span class="text-[11px] text-muted">
                {{ panels.slotNonPreferredFound(limit.offending) }}
              </span>
              <span />
              <AppButton
                variant="soft"
                class="mt-1 justify-self-start"
                @click="emit('selectLayers')"
              >
                {{ panels.selectLayers }}
              </AppButton>
            </template>
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
