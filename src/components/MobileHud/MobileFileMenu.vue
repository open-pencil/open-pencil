<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useMenuMessages } from '@open-pencil/vue'

import HudButton from '@/components/mobile-hud/HudButton.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'
import { menu, useMenuUI } from '@/components/ui/menu/menu'

const menuMessages = useMenuMessages()
const hud = useMobileHudContext()
const menuCls = useMenuUI({
  content: 'w-48 rounded-xl p-1.5 shadow-xl',
  item: 'w-full gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 active:bg-hover'
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
        <DropdownMenuItem
          v-for="item in hud.menuItems"
          :key="item.label"
          :class="menu({ justify: 'start' }).item({ class: menuCls.item })"
          @click="item.action()"
        >
          <component :is="item.icon" class="size-4 text-muted" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
