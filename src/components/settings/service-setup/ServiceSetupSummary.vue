<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue'

import type { SettingsSection } from '@/app/settings/dialog'
import { useServiceSetup, type ServiceSetupGroup } from '@/app/settings/service-setup/use'

import { useServiceSetupLabels } from './labels'

type GroupState = 'none' | 'partial' | 'files-only' | 'done'

/**
 * Service setup for the welcome, collapsed to its overall count; opened, one aligned row per
 * group that still needs something, each with one status and a link to the Settings section
 * that sets it up.
 */
const emit = defineEmits<{ open: [section: SettingsSection] }>()
const settings = useSettingsMessages()
const { groups, totals } = useServiceSetup()
const { groupLabels } = useServiceSetupLabels()
const open = ref(false)

function groupState(group: ServiceSetupGroup): GroupState {
  if (group.done === group.total) return 'done'
  if (group.id === 'storage') return 'files-only'
  return group.done === 0 ? 'none' : 'partial'
}

const pending = computed(() => groups.value.filter((group) => groupState(group) !== 'done'))

function statusLabel(group: ServiceSetupGroup): string {
  const state = groupState(group)
  if (state === 'files-only') return settings.value.serviceSetupFilesOnly
  if (state === 'none') return settings.value.serviceSetupNotSetUp
  return settings.value.serviceSetupPartial({ done: group.done, total: group.total })
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" data-test-id="service-setup-summary">
    <h3>
      <CollapsibleTrigger
        class="-m-1 flex w-[calc(100%+0.5rem)] cursor-pointer items-baseline justify-between gap-4 rounded p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span class="text-sm font-semibold text-surface">{{ settings.serviceSetup }}</span>
        <span class="inline-flex items-center gap-1 text-xs text-muted" data-service-total>
          {{ settings.serviceSetupProgress({ done: totals.done, total: totals.total }) }}
          <icon-lucide-chevron-down
            class="size-3.5 transition-transform duration-150 data-[open=true]:rotate-180"
            :data-open="open"
          />
        </span>
      </CollapsibleTrigger>
    </h3>
    <CollapsibleContent>
      <p class="mt-1 text-xs leading-relaxed text-balance text-muted">
        {{ settings.serviceSetupDescription }}
      </p>
      <ul v-if="pending.length" class="mt-2 flex flex-col">
        <li
          v-for="group in pending"
          :key="group.id"
          class="border-t border-border first:border-t-0"
          :data-service-group="group.id"
          :data-state="groupState(group)"
        >
          <button
            type="button"
            class="-mx-2 grid w-[calc(100%+1rem)] cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded px-2 py-2 text-left text-xs outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent/40"
            @click="emit('open', group.section)"
          >
            <span class="truncate text-surface">{{ groupLabels[group.id] }}</span>
            <span class="inline-flex items-center gap-1.5 text-muted">
              <icon-lucide-triangle-alert
                v-if="groupState(group) === 'files-only'"
                class="size-3.5 shrink-0 text-warning-action"
              />
              <icon-lucide-contrast
                v-else-if="groupState(group) === 'partial'"
                class="size-3.5 shrink-0 text-success"
              />
              <icon-lucide-circle v-else class="size-3.5 shrink-0 text-muted" />
              {{ statusLabel(group) }}
            </span>
            <span class="text-primary"
              >{{
                groupState(group) === 'partial'
                  ? settings.serviceSetupReview
                  : settings.serviceSetupSetUp
              }}
              ›</span
            >
          </button>
        </li>
      </ul>
      <p v-else class="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
        <icon-lucide-circle-check class="size-3.5 text-success" />
        {{ settings.serviceSetupAllDone }}
      </p>
      <p class="mt-3 text-xs leading-relaxed text-balance text-muted">
        {{ settings.serviceSetupComeBack }}
      </p>
      <button
        type="button"
        class="mt-1 cursor-pointer rounded text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
        data-service-open-all
        @click="emit('open', 'setup')"
      >
        {{ settings.serviceSetupSeeAll }} ›
      </button>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
