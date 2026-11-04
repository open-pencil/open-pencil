<script setup lang="ts">
import { computed } from 'vue'

import type { FigCompression } from '@open-pencil/scene-graph/fig-compression'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/** Settings for the whole document, shown with nothing selected. */
const store = useEditorStore()
const { panels } = useI18n()
const current = useSceneComputed(() => store.figCompression())

const compressionOptions = computed<Array<{ value: FigCompression; label: string }>>(() => [
  { value: 'fast', label: panels.value.compressionFast },
  { value: 'smaller', label: panels.value.compressionSmaller },
  { value: 'smallest', label: panels.value.compressionSmallest }
])

const compression = computed<FigCompression>({
  get: () => current.value,
  set: (value) => store.setFigCompression(value)
})
</script>

<template>
  <PanelSection :label="panels.document" data-test-id="document-section">
    <PanelFieldGroup :label="panels.compression">
      <AppSelect
        v-model="compression"
        :label="panels.compression"
        :options="compressionOptions"
        data-property="fig-compression"
      />
    </PanelFieldGroup>
  </PanelSection>
</template>
