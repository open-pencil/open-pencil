<script setup lang="ts">
import Tip from '@/components/ui/Tip.vue'
import { testId as testIdAttr, useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutMode } from '@open-pencil/core/scene-graph'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()

const layoutModes: { mode: LayoutMode; test: string }[] = [
  { mode: 'HORIZONTAL', test: 'horizontal' },
  { mode: 'VERTICAL', test: 'vertical' },
  { mode: 'GRID', test: 'grid' }
]
</script>

<template>
  <div class="flex items-center justify-between">
    <label class="mb-1.5 block text-[11px] text-muted">{{ panels.autoLayout }}</label>
    <Tip v-if="ctx.node.layoutMode === 'NONE'" :label="panels.addAutoLayout">
      <button
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-add-auto"
        @click="ctx.editor.setLayoutMode(ctx.node.id, 'VERTICAL')"
      >
        +
      </button>
    </Tip>
    <Tip v-else :label="panels.removeAutoLayout">
      <button
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-remove-auto"
        @click="ctx.editor.setLayoutMode(ctx.node.id, 'NONE')"
      >
        −
      </button>
    </Tip>
  </div>

  <div v-if="ctx.node.layoutMode !== 'NONE'" class="mt-1.5 flex gap-0.5">
    <button
      v-for="dir in layoutModes"
      :key="dir.mode"
      v-bind="testIdAttr(`layout-direction-${dir.test}`)"
      class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
      :class="
        (dir.mode === 'GRID' ? ctx.isGrid : ctx.node.layoutMode === dir.mode)
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-muted hover:bg-hover hover:text-surface'
      "
      @click="ctx.editor.setLayoutMode(ctx.node.id, dir.mode)"
    >
      <icon-lucide-arrow-right v-if="dir.mode === 'HORIZONTAL'" class="size-3.5" />
      <icon-lucide-arrow-down v-else-if="dir.mode === 'VERTICAL'" class="size-3.5" />
      <icon-lucide-layout-grid v-else class="size-3.5" />
    </button>
    <button
      v-if="ctx.isFlex"
      data-test-id="layout-direction-wrap"
      class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
      :class="
        ctx.node.layoutWrap === 'WRAP'
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-muted hover:bg-hover hover:text-surface'
      "
      @click="ctx.updateProp('layoutWrap', ctx.node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
    >
      <icon-lucide-wrap-text class="size-3.5" />
    </button>
  </div>
</template>
