<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'

const store = useEditorStore()

const status = computed(() => store.state.autosaveStatus)

const label = computed(() => {
  switch (status.value) {
    case 'saving':
      return '保存中...'
    case 'saved':
      return '保存しました'
    default:
      return ''
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="status !== 'idle'"
      data-test-id="autosave-status"
      class="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2 rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur"
    >
      <span
        v-if="status === 'saving'"
        class="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
      />
      <span
        v-else
        class="inline-block size-3 rounded-full bg-emerald-400"
      />
      {{ label }}
    </div>
  </Transition>
</template>
