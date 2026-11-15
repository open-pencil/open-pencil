<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from 'reka-ui'
import type { Component } from 'vue'
import IconCheck from '~icons/lucide/check'

import { layerTypeOptions, type LayerType } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import { useEditorStore } from '@/app/editor/active-store'
import { NODE_ICONS } from '@/components/icons'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

// Figma's layer type menu: a frame, a group, and a section switch to one another in place.
const { node, icon } = defineProps<{ node: SceneNode; icon: Component | undefined }>()

const store = useEditorStore()
const { panels, tools } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()

const types = [
  { type: 'SECTION', icon: NODE_ICONS.SECTION, label: () => tools.value.section },
  { type: 'FRAME', icon: NODE_ICONS.FRAME, label: () => panels.value.frame },
  { type: 'GROUP', icon: NODE_ICONS.GROUP, label: () => panels.value.group }
] as const

// Read when the menu renders, so it reflects where the layer sits now.
const disabled = (type: LayerType) => !layerTypeOptions(store.graph, node)[type]

const menuCls = useMenuUI({ content: 'min-w-36' })
const itemCls = menuItem({ justify: 'between' })
</script>

<template>
  <AppDropdownMenuRoot v-model:open="popupOpen">
    <DropdownMenuTrigger as-child>
      <!-- The header row is shorter than the button, so it overhangs the row as an icon would. -->
      <IconButton :label="panels.layerType" menu size="xs" class="-mx-1 -my-1.5">
        <component :is="icon" class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal v-if="portalActive">
      <DropdownMenuContent align="start" side="bottom" :side-offset="4" :class="menuCls.content">
        <MenuScrollArea>
          <DropdownMenuItem
            v-for="item in types"
            :key="item.type"
            :class="itemCls"
            :disabled="disabled(item.type)"
            @select="item.type !== node.type && store.convertLayerType(node.id, item.type)"
          >
            <div class="flex min-w-0 items-center gap-2">
              <component :is="item.icon" class="size-3.5 shrink-0 text-muted" />
              <span>{{ item.label() }}</span>
            </div>
            <IconCheck v-if="item.type === node.type" class="ms-4 size-3.5" />
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </AppDropdownMenuRoot>
</template>
