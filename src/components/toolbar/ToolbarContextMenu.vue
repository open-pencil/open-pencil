<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuTrigger } from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'

import { openSettingsDialog } from '@/app/settings/dialog'
import AppContextMenuRoot from '@/components/ui/menu/AppContextMenuRoot.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

/**
 * Right-clicking the toolbar offers its Settings page, unless the toolbar is `disabled` for
 * customizing, as a board's fixed one is.
 */
const { disabled = false } = defineProps<{ disabled?: boolean }>()
const { settings } = useI18n()
const menu = useMenuUI({ content: 'w-48', item: 'justify-start gap-2' })
</script>

<template>
  <AppContextMenuRoot>
    <ContextMenuTrigger as-child :disabled="disabled">
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
  </AppContextMenuRoot>
</template>
