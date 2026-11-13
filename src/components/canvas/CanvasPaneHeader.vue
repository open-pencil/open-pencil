<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import { formatShortcut } from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import type { SplitDirection } from '@/app/editor/panes/split-tree'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import ZoomDropdown from '@/components/editor/ZoomDropdown.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import canvasPaneHeaderTheme from '@/theme/canvas/pane-header'

const { paneId } = defineProps<{
  paneId: string
}>()

const store = useEditorStore()
const { menu: menuText, editor } = useI18n()
const view = computed(() => store.getPaneView(paneId))
const isActive = computed(() => store.activePaneId.value === paneId)
// Split view keeps the panels, so the canvas-only preview pill never shows; the header says it.
const previewing = computed(
  () => resolveEditorProfile(store.getPaneRenderState(paneId)).live !== null
)
const leaveShortcut = formatShortcut(appMenuShortcut('toggle-preview')) ?? ''
const pageName = computed(() => {
  const pageId = view.value?.currentPageId
  return pageId ? (store.graph.getNode(pageId)?.name ?? menuText.value.view) : menuText.value.view
})
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
    <template v-if="previewing">
      <span data-test-id="pane-previewing" :class="headerCls.badge()">
        <icon-lucide-play class="size-3" />
        <span :class="headerCls.badgeLabel()">{{ editor.previewing }}</span>
      </span>
      <IconButton :label="editor.resetPreview" size="xs" @click="store.resetPlay()">
        <icon-lucide-rotate-ccw :class="headerCls.icon()" />
      </IconButton>
      <IconButton
        :label="editor.leavePreview({ shortcut: leaveShortcut })"
        data-test-id="pane-leave-preview"
        size="xs"
        @click="store.stopPlay()"
      >
        <icon-lucide-square :class="headerCls.icon()" />
      </IconButton>
    </template>
    <ZoomDropdown :pane-id="paneId" />
    <div :class="headerCls.actions()">
      <AppDropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <IconButton :label="`${menuText.splitRight} / ${menuText.splitDown}`" size="xs">
            <icon-lucide-panels-top-left :class="headerCls.icon()" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" align="end" :side-offset="3" :class="menuCls.content">
            <MenuScrollArea>
              <DropdownMenuItem
                :disabled="!canSplit"
                :class="itemCls"
                @select="split('horizontal')"
              >
                <icon-lucide-columns-2 :class="menuCls.icon" />
                <span>{{ menuText.splitRight }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem :disabled="!canSplit" :class="itemCls" @select="split('vertical')">
                <icon-lucide-rows-2 :class="menuCls.icon" />
                <span>{{ menuText.splitDown }}</span>
              </DropdownMenuItem>
            </MenuScrollArea>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </AppDropdownMenuRoot>

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
