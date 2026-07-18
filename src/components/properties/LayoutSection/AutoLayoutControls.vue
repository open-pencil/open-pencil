<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import IconButton from '@/components/ui/IconButton.vue'

import type { LayoutMode } from '@open-pencil/scene-graph'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()

const layoutModes = computed<Array<{ mode: LayoutMode; label: string }>>(() => [
  { mode: 'HORIZONTAL', label: panels.value.layoutHorizontal },
  { mode: 'VERTICAL', label: panels.value.layoutVertical },
  { mode: 'GRID', label: panels.value.layoutGrid }
])
</script>

<template>
  <div class="flex items-center gap-1.5">
    <IconButton
      v-if="ctx.node.layoutMode === 'NONE'"
      :label="panels.addAutoLayout"
      @click="ctx.editor.setLayoutMode(ctx.node.id, 'VERTICAL')"
    >
      <icon-lucide-plus class="size-3.5" />
    </IconButton>
    <IconButton
      v-else
      :label="panels.removeAutoLayout"
      @click="ctx.editor.setLayoutMode(ctx.node.id, 'NONE')"
    >
      <icon-lucide-minus class="size-3.5" />
    </IconButton>
  </div>

  <div
    v-if="ctx.node.layoutMode !== 'NONE'"
    class="mt-1.5 flex items-center gap-1"
    role="toolbar"
    :aria-label="panels.flow"
  >
    <IconButton
      v-for="direction in layoutModes"
      :key="direction.mode"
      :label="direction.label"
      size="md"
      :active="direction.mode === 'GRID' ? ctx.isGrid : ctx.node.layoutMode === direction.mode"
      @click="ctx.editor.setLayoutMode(ctx.node.id, direction.mode)"
    >
      <icon-lucide-arrow-right v-if="direction.mode === 'HORIZONTAL'" class="size-3.5" />
      <icon-lucide-arrow-down v-else-if="direction.mode === 'VERTICAL'" class="size-3.5" />
      <icon-lucide-layout-grid v-else class="size-3.5" />
    </IconButton>
    <IconButton
      v-if="ctx.isFlex"
      :label="panels.layoutWrap"
      size="md"
      :active="ctx.node.layoutWrap === 'WRAP'"
      @click="ctx.updateProp('layoutWrap', ctx.node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
    >
      <icon-lucide-wrap-text class="size-3.5" />
    </IconButton>
  </div>
</template>
