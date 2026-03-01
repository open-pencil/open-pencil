<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const emit = defineEmits<{ openDialog: [] }>()

const collectionCount = computed(() => {
  void store.state.sceneVersion
  return store.graph.variableCollections.size
})

const variableCount = computed(() => {
  void store.state.sceneVersion
  return store.graph.variables.size
})
</script>

<template>
  <div class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">Variables</label>
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
        title="Open variables"
        @click="emit('openDialog')"
      >
        <icon-lucide-settings-2 class="size-3.5" />
      </button>
    </div>
    <div v-if="variableCount > 0" class="mt-1 text-[11px] text-muted">
      {{ variableCount }} variable{{ variableCount !== 1 ? 's' : '' }} in
      {{ collectionCount }} collection{{ collectionCount !== 1 ? 's' : '' }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">No local variables</div>
  </div>
</template>
