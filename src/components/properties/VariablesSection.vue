<script setup lang="ts">
import { sumBy } from 'es-toolkit'
import { computed } from 'vue'

import { isLibraryCollection } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const emit = defineEmits<{ openDialog: [] }>()

const editor = useEditorStore()
const localCollections = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getCollections().filter((collection) => !isLibraryCollection(collection))
})
const collectionCount = computed(() => localCollections.value.length)
const variableCount = computed(() =>
  sumBy(localCollections.value, (collection) => collection.variableIds.length)
)
const hasVariables = computed(() => variableCount.value > 0)
const { panels } = useI18n()
</script>

<template>
  <PanelSection :label="panels.variables" :empty="!hasVariables">
    <template #actions>
      <IconButton :label="panels.openVariables" @click="emit('openDialog')">
        <icon-lucide-square-arrow-out-up-right class="size-3.5" />
      </IconButton>
    </template>
    <div v-if="hasVariables" class="mt-1 text-2xs text-muted">
      {{ variableCount }} / {{ collectionCount }}
    </div>
    <div v-else class="mt-1 text-2xs text-muted">{{ panels.noLocalVariables }}</div>
  </PanelSection>
</template>
