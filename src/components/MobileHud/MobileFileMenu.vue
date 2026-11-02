<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useMenuMessages } from '@open-pencil/vue/i18n'

import HudButton from '@/components/mobile-hud/HudButton.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

const menuMessages = useMenuMessages()
const hud = useMobileHudContext()
const menuCls = useMenuUI({ content: 'w-48 p-1.5' })
const itemCls = menuItem({
  justify: 'start',
  class: 'w-full gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 active:bg-hover'
})
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <HudButton icon-only :label="menuMessages.file">
        <icon-lucide-menu class="size-3.5" />
      </HudButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :side-offset="8" side="bottom" align="end" :class="menuCls.content">
        <MenuScrollArea>
          <DropdownMenuItem
            v-for="item in hud.menuItems"
            :key="item.label"
            :class="itemCls"
            @click="item.action()"
          >
            <component :is="item.icon" class="size-4 text-muted" />
            <span>{{ item.label }}</span>
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
