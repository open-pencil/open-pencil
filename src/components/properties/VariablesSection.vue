<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/Tip.vue'
import { sectionWrapper } from '@/components/ui/section'
import { useEditor, useSceneComputed } from '@open-pencil/vue'

const emit = defineEmits<{ openDialog: [] }>()

const editor = useEditor()
const collectionCount = useSceneComputed(() => editor.getCollectionCount())
const variableCount = useSceneComputed(() => editor.getVariableCount())
const hasVariables = computed(() => variableCount.value > 0)
</script>

<template>
  <div data-test-id="variables-section" :class="sectionWrapper()">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">Variables</label>
      <Tip label="Open variables">
        <button
          data-test-id="variables-section-open"
          class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          @click="emit('openDialog')"
        >
          <icon-lucide-settings-2 class="size-3.5" />
        </button>
      </Tip>
    </div>
    <div v-if="hasVariables" class="mt-1 text-[11px] text-muted">
      {{ variableCount }} variable{{ variableCount !== 1 ? 's' : '' }} in
      {{ collectionCount }} collection{{ collectionCount !== 1 ? 's' : '' }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">No local variables</div>
  </div>
</template>
