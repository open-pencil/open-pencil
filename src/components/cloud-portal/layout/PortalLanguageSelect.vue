<script setup lang="ts">
import { computed } from 'vue'

import { type Locale, useI18n } from '@open-pencil/vue/i18n'

import AppSelect from '@/components/ui/select/AppSelect.vue'
import { focusStyles } from '@/theme/focus/styles'

/**
 * The language of a Cloud page, as Settings sets it in the editor: the same list and names, and
 * the same saved choice, which the editor on this server's address shares. It sits among the
 * footer's links, so it looks like one, as the chat's thinking level does among its controls.
 */
const { availableLocales, locale, localeLabels, menu, setLocale } = useI18n()
const language = computed<Locale>({
  get: () => locale.value,
  set: setLocale
})
const options = availableLocales.map((value) => ({ value, label: localeLabels[value] }))
const trigger = [
  'flex items-center gap-1.5 rounded-sm text-sm text-muted transition-colors hover:text-surface data-[state=open]:text-surface',
  focusStyles.ring
]
</script>

<template>
  <AppSelect v-model="language" :label="menu.language" :options="options" placement="below">
    <template #trigger>
      <button type="button" :class="trigger">
        <icon-lucide-languages class="size-3.5" aria-hidden="true" />
        {{ localeLabels[locale] }}
        <icon-lucide-chevron-down class="size-3" aria-hidden="true" />
      </button>
    </template>
  </AppSelect>
</template>
