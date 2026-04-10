<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/ui/Tip.vue'
import { useSectionUI } from '@/components/ui/section'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import { useEditorStore } from '@/stores/editor'

const emit = defineEmits<{ openDialog: [] }>()

const editor = useEditorStore()
const collectionCount = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getCollectionCount()
})
const variableCount = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getVariableCount()
})
const hasVariables = computed(() => variableCount.value > 0)
const sectionCls = useSectionUI()
const { panels } = useI18n()
</script>

<template>
  <div data-test-id="variables-section" :class="sectionCls.wrapper">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">{{ panels.variables }}</label>
      <Tip :label="panels.openVariables">
        <button tabindex="0"
          data-test-id="variables-section-open"
          class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
          @click="emit('openDialog')"
        >
          <icon-lucide-settings-2 class="size-3.5" />
        </button>
      </Tip>
    </div>
    <div v-if="hasVariables" class="mt-1 text-[11px] text-muted">
      {{ variableCount }} / {{ collectionCount }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">{{ panels.noLocalVariables }}</div>
  </div>
</template>
