<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { nextTick, watch } from 'vue'
import { templateRef } from '@vueuse/core'

import { useI18n, useViewportKind } from '@open-pencil/vue'

import { openFileDialog } from '@/app/shell/menu/use'
import { activeTab } from '@/app/tabs'

const emit = defineEmits<{ 'new-document': [] }>()
const query = defineModel<string>({ required: true })
const { menu, files } = useI18n()
const { isMobile } = useViewportKind()
const searchInput = templateRef<HTMLInputElement>('searchInput')

async function focusSearch(): Promise<void> {
  if (isMobile.value || activeTab.value?.kind !== 'home') return
  await nextTick()
  setTimeout(() => searchInput.value?.focus(), 300)
}

watch(
  () => activeTab.value?.id,
  () => void focusSearch(),
  { immediate: true }
)
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center">
    <label
      class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-panel px-3.5 focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-panel-focus sm:h-9 sm:gap-2 sm:bg-panel-field sm:px-3 sm:focus-within:ring-0"
    >
      <icon-lucide-search class="size-4.5 shrink-0 text-muted sm:size-4" />
      <input
        ref="searchInput"
        v-model="query"
        type="search"
        name="file-search"
        autocomplete="off"
        class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        :placeholder="isMobile ? files.searchFiles : files.searchRecentAndStorageFiles"
        :aria-label="files.searchFiles"
      />
    </label>
    <div class="grid grid-cols-2 gap-2 sm:contents">
      <AppButton size="lg" variant="outline" data-test-id="home-open-file" @click="openFileDialog">
        <template #leading><icon-lucide-folder-open class="size-3.5" /></template>
        {{ menu.open }}
      </AppButton>
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        data-test-id="home-new-document"
        @click="emit('new-document')"
      >
        <template #leading><icon-lucide-plus class="size-3.5" /></template>
        {{ files.newDesign }}
      </AppButton>
    </div>
  </div>
</template>
