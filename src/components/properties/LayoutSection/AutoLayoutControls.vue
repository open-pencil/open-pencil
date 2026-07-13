<script setup lang="ts">
import IconButton from '@/components/ui/IconButton.vue'
import PanelRow from '@/components/ui/panel/PanelRow.vue'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutMode } from '@open-pencil/scene-graph'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()

const layoutModes: { mode: LayoutMode; test: string }[] = [
  { mode: 'HORIZONTAL', test: 'horizontal' },
  { mode: 'VERTICAL', test: 'vertical' },
  { mode: 'GRID', test: 'grid' }
]
</script>

<template>
  <PanelRow>
    <IconButton
      v-if="ctx.node.layoutMode === 'NONE'"
      :label="panels.addAutoLayout"
      data-test-id="layout-add-auto"
      @click="ctx.editor.setLayoutMode(ctx.node.id, 'VERTICAL')"
    >
      <icon-lucide-plus class="size-3.5" />
    </IconButton>
    <IconButton
      v-else
      :label="panels.removeAutoLayout"
      data-test-id="layout-remove-auto"
      @click="ctx.editor.setLayoutMode(ctx.node.id, 'NONE')"
    >
      <icon-lucide-minus class="size-3.5" />
    </IconButton>
  </PanelRow>

  <PanelRow v-if="ctx.node.layoutMode !== 'NONE'" class="mt-1.5" gap="sm">
    <IconButton
      v-for="dir in layoutModes"
      :key="dir.mode"
      size="md"
      :active="dir.mode === 'GRID' ? ctx.isGrid : ctx.node.layoutMode === dir.mode"
      :data-test-id="`layout-direction-${dir.test}`"
      @click="ctx.editor.setLayoutMode(ctx.node.id, dir.mode)"
    >
      <icon-lucide-arrow-right v-if="dir.mode === 'HORIZONTAL'" class="size-3.5" />
      <icon-lucide-arrow-down v-else-if="dir.mode === 'VERTICAL'" class="size-3.5" />
      <icon-lucide-layout-grid v-else class="size-3.5" />
    </IconButton>
    <IconButton
      v-if="ctx.isFlex"
      size="md"
      :active="ctx.node.layoutWrap === 'WRAP'"
      data-test-id="layout-direction-wrap"
      @click="ctx.updateProp('layoutWrap', ctx.node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
    >
      <icon-lucide-wrap-text class="size-3.5" />
    </IconButton>
  </PanelRow>
</template>
