<script setup lang="ts">
import { computed } from 'vue'

import IconButton from '@/components/ui/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'

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
const { panels } = useI18n()
</script>

<template>
  <PanelSection :label="panels.variables" :empty="!hasVariables">
    <template #actions>
      <IconButton :label="panels.openVariables" @click="emit('openDialog')">
        <icon-lucide-settings-2 class="size-3.5" />
      </IconButton>
    </template>
    <div v-if="hasVariables" class="mt-1 text-[11px] text-muted">
      {{ variableCount }} / {{ collectionCount }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">{{ panels.noLocalVariables }}</div>
  </PanelSection>
</template>
