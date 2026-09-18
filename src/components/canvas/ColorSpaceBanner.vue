<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { activeTab } from '@/app/tabs'
import ExternalLink from '@/components/links/ExternalLink.vue'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/** Neutral capability reference: the floating-point drawing buffer support table. */
const supportURL = 'https://caniuse.com/mdn-api_webglrenderingcontext_drawingbufferstorage'

const { rendering, common } = useI18n()

// The surface reports what it actually presents, so this notice appears only when a
// Display-P3 document really is being shown in sRGB.
const show = computed(() => {
  const state = activeTab.value?.store.state
  // Both fields are read unconditionally so the computed keeps depending on each of them.
  const presentation = state?.canvasPresentation
  const documentColorSpace = state?.documentColorSpace
  return presentation === 'srgb' && documentColorSpace === 'display-p3'
})

const message = computed(() => rendering.value.wideGamutUnavailable)
</script>

<template>
  <AppBanner v-if="show" test-id="wide-gamut-banner" storage-key="wide-gamut-banner-dismissed">
    {{ message }}
    <ExternalLink :href="supportURL" class="ml-1">{{ common.browserSupport }}</ExternalLink>
    <template #dismiss>{{ common.dismiss }}</template>
  </AppBanner>
</template>
