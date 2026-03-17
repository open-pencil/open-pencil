<script setup lang="ts">
import { computed } from 'vue'

import ColorInput from '@/components/ColorInput.vue'
import { sectionWrapper } from '@/components/ui/section'
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageColor = computed(() => editor.state.pageColor)
</script>

<template>
  <div data-test-id="page-section" :class="sectionWrapper()">
    <label class="mb-1.5 block text-[11px] text-muted">Page</label>
    <ColorInput :color="pageColor" editable @update="editor.setPageColor($event)" />
  </div>
</template>
