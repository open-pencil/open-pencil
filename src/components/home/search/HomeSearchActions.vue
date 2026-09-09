<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { nextTick, watch } from 'vue'

import { useI18n, useViewportKind } from '@open-pencil/vue'

import { openFileDialog } from '@/app/shell/menu/use'
import { activeTab } from '@/app/tabs'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const query = defineModel<string>({ required: true })
const { menu, files } = useI18n()
const { isMobile } = useViewportKind()
const searchInput = templateRef<{ focus: (options?: FocusOptions) => void }>('searchInput')

function focusSearch(onCleanup: (cleanup: () => void) => void): void {
  if (isMobile.value || activeTab.value?.kind !== 'home') return
  const tabId = activeTab.value.id
  const previousFocus = document.activeElement
  if (previousFocus instanceof HTMLElement && previousFocus.closest('[role="tablist"]')) return
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  void nextTick(() => {
    if (cancelled || isMobile.value || activeTab.value?.id !== tabId) return
    if (document.activeElement !== previousFocus) return
    searchInput.value?.focus({ preventScroll: true })
  })
}

watch(
  () => activeTab.value?.id,
  (_id, _previousId, onCleanup) => focusSearch(onCleanup),
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center">
    <AppInput
      ref="searchInput"
      v-model="query"
      type="search"
      name="file-search"
      autocomplete="off"
      class="sm:flex-1"
      :density="isMobile ? 'comfortable' : 'compact'"
      :placeholder="isMobile ? files.searchFiles : files.searchRecentAndStorageFiles"
      :aria-label="files.searchFiles"
    >
      <template #leading><icon-lucide-search class="size-4" /></template>
    </AppInput>
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
