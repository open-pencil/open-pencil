<script setup lang="ts">
import {
  MenubarCheckboxItem,
  MenubarItemIndicator
} from 'reka-ui'

import { menuItem } from '@/components/ui/menu'
import { useI18n } from '@/composables/use-i18n'

const { locale, availableLocales, localeNames } = useI18n()
</script>

<template>
  <MenubarCheckboxItem
    v-for="loc in availableLocales"
    :key="loc"
    :model-value="locale === loc"
    :class="menuItem()"
    @update:model-value="locale = loc"
  >
    <span class="flex-1">{{ localeNames[loc] }}</span>
    <MenubarItemIndicator class="text-surface">
      <icon-lucide-check class="size-3.5" />
    </MenubarItemIndicator>
  </MenubarCheckboxItem>
</template>