<script setup lang="ts">
import { AppButton, AppSelect } from '@open-pencil/ui'
import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'

import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const colorMode = useColorMode({
  attribute: 'data-theme',
  emitAuto: false,
  storageKey: 'open-pencil-cloud-theme'
})
const isDark = computed(() => colorMode.value === 'dark')
const themeLabel = computed(() =>
  isDark.value ? messages.common.value.themeLight : messages.common.value.themeDark
)
const localeLabels = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pl: 'Polski',
  ru: 'Русский',
  'zh-CN': '简体中文'
} as const
const localeOptions = messages.locales.map((locale) => ({
  value: locale,
  label: localeLabels[locale]
}))
const selectedLocale = computed({
  get: () => messages.locale.value,
  set: messages.setLocale
})
</script>

<template>
  <div class="flex items-center gap-1">
    <AppSelect
      v-model="selectedLocale"
      :label="messages.common.value.language"
      :options="localeOptions"
      class="w-24 sm:w-28"
    />
    <AppButton
      :aria-label="themeLabel"
      :aria-pressed="isDark"
      variant="ghost"
      size="xs"
      shape="square"
      @click="colorMode = isDark ? 'light' : 'dark'"
    >
      <icon-lucide-sun v-if="isDark" aria-hidden="true" class="size-3.5" />
      <icon-lucide-moon v-else aria-hidden="true" class="size-3.5" />
    </AppButton>
  </div>
</template>
