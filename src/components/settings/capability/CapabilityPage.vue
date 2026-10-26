<script setup lang="ts">
import { AppDialogBody } from '@/components/ui/dialog'
import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * A capability list's page: a bar with the page's own controls, how many are on, its actions,
 * and search, over the scrolling list. Tool access and Skills share it.
 */
const { count, searchLabel } = defineProps<{ count: string; searchLabel: string }>()
const search = defineModel<string>('search', { required: true })
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3 sm:px-6"
      data-slot="capability-toolbar"
    >
      <slot name="leading" />
      <span class="text-xs text-muted">{{ count }}</span>
      <slot name="actions" />
      <AppInput
        v-model="search"
        type="search"
        class="ml-auto min-w-40 flex-1 sm:max-w-60"
        :placeholder="searchLabel"
        :aria-label="searchLabel"
      />
    </div>
    <AppDialogBody :ui="{ body: 'p-5 sm:p-6' }">
      <slot />
    </AppDialogBody>
  </div>
</template>
