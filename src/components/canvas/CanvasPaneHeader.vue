<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import type { SplitDirection } from '@/app/editor/panes/split-tree'
import IconButton from '@/components/ui/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import canvasPaneHeaderTheme from '@/theme/canvas-pane-header'

const { paneId } = defineProps<{
  paneId: string
}>()

const store = useEditorStore()
const { menu: menuText } = useI18n()
const pane = computed(() => store.panes.getPane(paneId))
const isActive = computed(() => store.activePaneId.value === paneId)
const pageName = computed(() => {
  const pageId = pane.value?.currentPageId
  return pageId ? (store.graph.getNode(pageId)?.name ?? menuText.value.view) : menuText.value.view
})
const zoom = computed(() => Math.round((pane.value?.zoom ?? 1) * 100))
const canSplit = computed(() => store.visiblePaneCount.value < store.panes.maxVisiblePanes)
const canClose = computed(() => store.visiblePaneCount.value > 1)
const menuCls = useMenuUI({ content: 'min-w-40' })
const itemCls = menuItem({ justify: 'start' })
const headerStyles = tv(canvasPaneHeaderTheme)
const headerCls = computed(() => headerStyles({ active: isActive.value }))

function activatePane() {
  store.setActivePane(paneId)
}

function split(direction: SplitDirection) {
  activatePane()
  store.splitPane(paneId, direction)
}
</script>

<template>
  <div
    data-slot="canvas-pane-header"
    :data-active="isActive ? 'true' : 'false'"
    :class="headerCls.root()"
    @pointerdown="activatePane"
  >
    <span :class="headerCls.title()">{{ pageName }}</span>
    <span :class="headerCls.zoom()">{{ zoom }}%</span>
    <div :class="headerCls.actions()">
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <IconButton :label="`${menuText.splitRight} / ${menuText.splitDown}`" size="xs">
            <icon-lucide-panels-top-left :class="headerCls.icon()" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" align="end" :side-offset="3" :class="menuCls.content">
            <DropdownMenuItem :disabled="!canSplit" :class="itemCls" @select="split('horizontal')">
              <icon-lucide-columns-2 :class="menuCls.icon" />
              <span>{{ menuText.splitRight }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!canSplit" :class="itemCls" @select="split('vertical')">
              <icon-lucide-rows-2 :class="menuCls.icon" />
              <span>{{ menuText.splitDown }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <IconButton
        :label="menuText.closeView"
        side="bottom"
        size="xs"
        :disabled="!canClose"
        @click="store.closePane(paneId)"
      >
        <icon-lucide-x :class="headerCls.icon()" />
      </IconButton>
    </div>
  </div>
</template>
