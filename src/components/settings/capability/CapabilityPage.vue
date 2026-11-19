<script setup lang="ts">
import { computed } from 'vue'

import { useCommonMessages, useSettingsMessages } from '@open-pencil/vue/i18n'

import { AppDialogBody } from '@/components/ui/dialog'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import type { CapabilityFilter } from './types'

/**
 * A capability list's page: what it is with its main action, then search and a filter by whether
 * items are on, over the scrolling list. Tool access and Skills share it.
 */
const { searchLabel } = defineProps<{ searchLabel: string }>()
const search = defineModel<string>('search', { required: true })
const show = defineModel<CapabilityFilter>('show', { required: true })

const common = useCommonMessages()
const settings = useSettingsMessages()
const showOptions = computed(() => [
  { value: 'all' as const, label: settings.value.capabilityShowAll },
  { value: 'enabled' as const, label: common.value.enabled },
  { value: 'disabled' as const, label: common.value.disabled }
])
</script>

<template>
  <div class="@container/capability-page flex min-h-0 min-w-0 flex-1 flex-col">
    <div
      class="flex shrink-0 flex-col gap-3 border-b border-border px-5 pt-4 pb-3 sm:px-6"
      data-slot="capability-toolbar"
    >
      <div class="flex items-start justify-between gap-4 @max-md/capability-page:flex-col">
        <p class="max-w-prose text-xs leading-relaxed text-muted"><slot name="description" /></p>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AppInput
          v-model="search"
          type="search"
          class="min-w-40 flex-1"
          :placeholder="searchLabel"
          :aria-label="searchLabel"
        />
        <AppSelect
          v-model="show"
          :options="showOptions"
          :label="settings.capabilityShow"
          size="sm"
          :ui="{ trigger: 'w-auto' }"
        />
        <slot name="tools" />
      </div>
    </div>
    <!-- Padded inside the scroll area, so the list's group rows stick to its very top. -->
    <AppDialogBody :ui="{ body: 'p-0' }">
      <div class="flex flex-col gap-3 p-5 sm:p-6">
        <slot />
      </div>
    </AppDialogBody>
  </div>
</template>
