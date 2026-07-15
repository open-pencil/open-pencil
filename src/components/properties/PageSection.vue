<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { useEditorStore } from '@/app/editor/active-store'

const editor = useEditorStore()
const pageColor = computed(() => editor.state.pageColor)
const { panels } = useI18n()
</script>

<template>
  <PanelSection :label="panels.page ?? 'Page'" data-test-id="page-section">
    <ColorInput :color="pageColor" editable @update="editor.setPageColor($event)" />
  </PanelSection>
</template>
