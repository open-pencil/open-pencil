<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useMenuUI } from '@/components/ui/menu/menu'

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
        <ContextMenuItem :class="menu.item" @select="openSettingsDialog('toolbar')">
          <icon-lucide-sliders-horizontal :class="menu.icon" />
          {{ settings.customizeToolbar }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
