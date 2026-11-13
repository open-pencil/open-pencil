<script setup lang="ts">
import { provide, type Component } from 'vue'

import type { EmailLocalization } from '../i18n'
import { EMAIL_LOCALIZATION } from './localization'

/** Renders an email in its reader's language, which it and its layout read. */
const { email, props, localization } = defineProps<{
  email: Component
  props: Record<string, unknown>
  localization: EmailLocalization
}>()

provide(EMAIL_LOCALIZATION, localization)
</script>

<template>
  <component :is="email" v-bind="props" />
</template>
