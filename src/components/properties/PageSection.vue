<script setup lang="ts">
import ColorInput from '@/components/ColorInput.vue'
import { useEditorStore } from '@/stores/editor'
import { CANVAS_BG_COLOR } from '@open-pencil/core'

import type { Color } from '@open-pencil/core'

const store = useEditorStore()

function updateColor(color: Color) {
  store.state.pageColor = color
  store.requestRender()
}

function resetColor() {
  store.state.pageColor = { ...CANVAS_BG_COLOR }
  store.requestRender()
}
</script>

<template>
  <div data-test-id="page-section" class="border-b border-border px-3 py-2">
    <div class="mb-1.5 flex items-center justify-between">
      <label class="text-[11px] text-muted">Page</label>
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
        title="Reset to default canvas color"
        @click="resetColor"
      >
        <icon-lucide-rotate-ccw class="size-3.5" />
      </button>
    </div>
    <ColorInput :color="store.state.pageColor" editable @update="updateColor" />
  </div>
</template>
