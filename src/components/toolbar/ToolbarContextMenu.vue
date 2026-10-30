<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

/** Right-clicking the toolbar offers its Settings page. */
const { settings } = useI18n()
const menu = useMenuUI({ content: 'w-48', item: 'justify-start gap-2' })
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="menu.content">
        <MenuScrollArea>
          <ContextMenuItem :class="menu.item" @select="openSettingsDialog('editor', 'toolbar')">
            <icon-lucide-sliders-horizontal :class="menu.icon" />
            {{ settings.customizeToolbar }}
          </ContextMenuItem>
        </MenuScrollArea>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
