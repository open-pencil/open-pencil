<script setup lang="ts">
import { computed } from 'vue'

import { type Locale, useI18n } from '@open-pencil/vue/i18n'

import AppSelect from '@/components/ui/select/AppSelect.vue'

/**
 * The language of a Cloud page, as Settings sets it in the editor: the same list and names, and
 * the same saved choice, which the editor on this server's address shares.
 */
const { availableLocales, locale, localeLabels, menu, setLocale } = useI18n()
const language = computed<Locale>({
  get: () => locale.value,
  set: setLocale
})
const options = availableLocales.map((value) => ({ value, label: localeLabels[value] }))
</script>

<template>
  <AppSelect
    v-model="language"
    :label="menu.language"
    :options="options"
    :ui="{ trigger: 'w-auto gap-1.5' }"
  >
    <template #leading><icon-lucide-languages class="size-3.5" /></template>
  </AppSelect>
</template>
