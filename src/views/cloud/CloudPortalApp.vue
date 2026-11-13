<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { RouterView } from 'vue-router'

import { useI18n } from '@open-pencil/vue/i18n'

import { usePortalTheme } from '@/app/cloud-portal/theme'
import { useInterfaceDirection } from '@/app/i18n/direction'
import PortalToaster from '@/components/cloud-portal/layout/PortalToaster.vue'

usePortalTheme()
// As the editor's root: the page's language, and right to left for Arabic unless mirroring is off.
const { locale } = useI18n()
useHead({ htmlAttrs: { lang: locale, dir: useInterfaceDirection() } })
</script>

<template>
  <RouterView />
  <PortalToaster />
</template>
