<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import { useAppMenu } from '@/app/shell/menu/app-menu'
import { resolvedAppTheme } from '@/app/shell/theme'
import BrandMark from '@/components/brand/BrandMark.vue'
import MainMenuEntries from '@/components/shell/MainMenuEntries.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import { IS_TAURI } from '@/constants'
import navigationRailTheme from '@/theme/shell/navigation-rail'

// The browser's main menu opens from the mark, as in Figma; the desktop app uses native menus.
const { menu: t } = useI18n()
const { mainMenu } = useAppMenu()
const mainMenuCls = useMenuUI({ content: 'min-w-52' })
const railStyles = tv(navigationRailTheme)({ mark: true })
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <BrandMark
    v-if="IS_TAURI"
    data-test-id="app-logo"
    variant="app-icon"
    :appearance="resolvedAppTheme"
    class="size-6"
  />
  <DropdownMenuRoot v-else v-model:open="open">
    <DropdownMenuTrigger :aria-label="t.mainMenu" :class="railStyles.item()">
      <icon-brand-mark-modular :class="railStyles.icon()" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- Focus stays where the chosen action put it, such as a dialog it opened. -->
      <DropdownMenuContent
        :side-offset="4"
        side="right"
        align="start"
        :class="mainMenuCls.content"
        @close-auto-focus.prevent
      >
        <MainMenuEntries :entries="mainMenu" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
