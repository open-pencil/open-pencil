<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useEditorStore } from '@/app/editor/active-store'
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

function setLayout(sizes: number[]) {
  if (node.type === 'split') store.setSplitSizes(node.id, sizes)
}
</script>

<template>
  <div
    v-if="node.type === 'pane'"
    :data-pane-id="node.paneId"
    class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
  >
    <CanvasPaneHeader v-if="store.visiblePaneCount.value > 1" :pane-id="node.paneId" />
    <EditorCanvas :pane-id="node.paneId" />
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
