<script setup lang="ts">
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()
</script>

<template>
  <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs text-surface">
    <input
      type="checkbox"
      data-test-id="clip-content-checkbox"
      class="accent-accent"
      :checked="ctx.node.clipsContent"
      @change="
        ctx.editor.updateNodeWithUndo(
          ctx.node.id,
          { clipsContent: !ctx.node.clipsContent },
          'Toggle clip content'
        )
      "
    />
    {{ panels.clipContent }}
  </label>
</template>
