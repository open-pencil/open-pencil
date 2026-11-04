<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasViewportBounds } from '@/app/editor/canvas/viewport'
import type { CanvasSplitNode } from '@/app/editor/panes/split-tree'
import CanvasPaneHeader from '@/components/canvas/CanvasPaneHeader.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import splitterTheme from '@/theme/splitter'

const { node } = defineProps<{
  node: CanvasSplitNode
}>()

const store = useEditorStore()
const direction = computed(() => (node.type === 'split' ? node.direction : 'horizontal'))
const splitterStyles = tv(splitterTheme)
const visibleBounds = useCanvasViewportBounds(useTemplateRef<HTMLElement>('pane'))
const { height: headerHeight } = useElementSize(useTemplateRef<HTMLElement>('header'))
const showHeader = computed(() => store.state.showUI && store.visiblePaneCount.value > 1)

function setLayout(sizes: number[]) {
  if (node.type === 'split') store.setSplitSizes(node.id, sizes)
}
</script>

<template>
  <div
    v-if="node.type === 'pane'"
    ref="pane"
    :data-pane-id="node.paneId"
    class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
  >
    <EditorCanvas :pane-id="node.paneId" :header-height="showHeader ? headerHeight : 0" />
    <div
      v-if="showHeader"
      ref="header"
      class="absolute top-0 z-10"
      :style="{ left: `${visibleBounds.x}px`, width: `${visibleBounds.width}px` }"
    >
      <CanvasPaneHeader :pane-id="node.paneId" />
    </div>
  </div>

  <SplitterGroup
    v-else
    :id="node.id"
    :direction="direction"
    class="flex min-h-0 min-w-0 flex-1 overflow-hidden"
    @layout="setLayout"
  >
    <template
      v-for="(child, index) in node.children"
      :key="child.type === 'pane' ? child.paneId : child.id"
    >
      <SplitterPanel
        :id="`${node.id}-panel-${index}`"
        :default-size="node.sizes[index]"
        :min-size="12"
        class="flex min-h-0 min-w-0 overflow-hidden"
      >
        <CanvasSplitNode :node="child" />
      </SplitterPanel>
      <SplitterResizeHandle
        v-if="index < node.children.length - 1"
        :id="`${node.id}-handle-${index}`"
        :data-split-id="node.id"
        :class="splitterStyles({ direction }).handle()"
      >
        <div :class="splitterStyles({ direction }).divider()" />
      </SplitterResizeHandle>
    </template>
  </SplitterGroup>
</template>
