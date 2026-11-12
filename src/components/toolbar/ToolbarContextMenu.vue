<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIndicator,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'
import { useToolbar } from '@open-pencil/vue/primitives/Toolbar'

import { isToolbarAlign, isToolbarSide } from '@/app/editor/toolbar/dock'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useToolbarAlignOptions, useToolbarSideOptions } from '@/components/toolbar/dock'
import AppContextMenuRoot from '@/components/ui/menu/AppContextMenuRoot.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

/**
 * Right-clicking the toolbar moves it to another edge or end, or opens its Settings page, unless
 * the toolbar is `disabled` for customizing, as a board's fixed one is.
 */
const { disabled = false, dockable = false } = defineProps<{
  disabled?: boolean
  /** Offers the edges and alignments; the mobile toolbar has a fixed place. */
  dockable?: boolean
}>()

const { settings } = useI18n()
const { side, align, setSide, setAlign } = useToolbar()
const sideOptions = useToolbarSideOptions()
const alignOptions = useToolbarAlignOptions(side)
const menu = useMenuUI({ content: 'w-48', item: 'justify-start gap-2' })

function dock(value: unknown) {
  if (isToolbarSide(value)) setSide(value)
}

function alignTo(value: unknown) {
  if (isToolbarAlign(value)) setAlign(value)
}
</script>

<template>
  <AppContextMenuRoot>
    <ContextMenuTrigger as-child :disabled="disabled">
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="menu.content">
        <MenuScrollArea>
          <template v-if="dockable">
            <ContextMenuLabel :class="menu.label">{{ settings.toolbarPosition }}</ContextMenuLabel>
            <ContextMenuRadioGroup
              :model-value="side"
              :aria-label="settings.toolbarPosition"
              @update:model-value="dock"
            >
              <ContextMenuRadioItem
                v-for="option in sideOptions"
                :key="option.value"
                :value="option.value"
                :class="menu.item"
              >
                <component :is="option.icon" :class="menu.icon" />
                <span class="flex-1">{{ option.label }}</span>
                <ContextMenuItemIndicator>
                  <icon-lucide-check class="size-3.5" />
                </ContextMenuItemIndicator>
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator :class="menu.separator" />
            <ContextMenuLabel :class="menu.label">{{ settings.toolbarAlignment }}</ContextMenuLabel>
            <ContextMenuRadioGroup
              :model-value="align"
              :aria-label="settings.toolbarAlignment"
              @update:model-value="alignTo"
            >
              <ContextMenuRadioItem
                v-for="option in alignOptions"
                :key="option.value"
                :value="option.value"
                :class="menu.item"
              >
                <span :class="menu.icon" aria-hidden="true" />
                <span class="flex-1">{{ option.label }}</span>
                <ContextMenuItemIndicator>
                  <icon-lucide-check class="size-3.5" />
                </ContextMenuItemIndicator>
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator :class="menu.separator" />
          </template>
          <ContextMenuItem :class="menu.item" @select="openSettingsDialog('editor', 'toolbar')">
            <icon-lucide-sliders-horizontal :class="menu.icon" />
            {{ settings.customizeToolbar }}
          </ContextMenuItem>
        </MenuScrollArea>
      </ContextMenuContent>
    </ContextMenuPortal>
  </AppContextMenuRoot>
</template>
