<script setup lang="ts">
import ColorInput from '@/components/ColorInput.vue'
import { useEditorStore } from '@/stores/editor'

import type { Color } from '@open-pencil/core'

const store = useEditorStore()

function updateColor(color: Color) {
  store.state.pageColor = color
  store.requestRender()
}
</script>

<template>
  <div data-test-id="page-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Page</label>
    <ColorInput :color="store.state.pageColor" editable @update="updateColor" />
  </div>
</template>
