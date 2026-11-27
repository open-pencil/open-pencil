<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { MotionConfig } from 'motion-v'
import { ConfigProvider, TooltipProvider } from 'reka-ui'
import { computed } from 'vue'

import { useLocale } from '@open-pencil/vue/i18n'

import { useInterfaceDirection } from '@/app/i18n/direction'
import { interfaceScalePreference } from '@/app/shell/interface-scale'
import { animationsEnabled } from '@/app/shell/motion'

/**
 * What every page of the app shares: the document's language, direction, interface size, and
 * motion policy. The editor's services and dialogs belong to its layout, which embeds never load.
 */
const { locale } = useLocale()
const dir = useInterfaceDirection()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: {
    lang: locale,
    dir,
    'data-interface-scale': interfaceScalePreference,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})
</script>

<template>
  <MotionConfig :reduced-motion="animationsEnabled ? 'never' : 'always'">
    <ConfigProvider :dir="dir">
      <TooltipProvider :delay-duration="400">
        <RouterView />
      </TooltipProvider>
    </ConfigProvider>
  </MotionConfig>
</template>
