<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { RouterView } from 'vue-router'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalTheme } from '@/app/cloud-portal/theme'
import { useInterfaceDirection } from '@/app/i18n/direction'
import PortalToaster from '@/components/cloud-portal/layout/PortalToaster.vue'

usePortalTheme()
// As the editor's root: the page's language, and right to left for Arabic unless mirroring is off.
const { locale } = useI18n()
const messages = useCloudPortalMessages()
const portal = usePortal()
// Each page names itself, as the editor's do: "Sign in — OpenPencil Cloud", or a self-hosted
// server's own name in place of the product's.
const site = () =>
  (portal.discovery.deployment === 'self-hosted' ? portal.discovery.branding?.name : undefined) ??
  messages.value.productName
useHead({
  titleTemplate: (title) => (title ? `${title} — ${site()}` : site()),
  htmlAttrs: { lang: locale, dir: useInterfaceDirection() }
})
</script>

<template>
  <RouterView />
  <PortalToaster />
</template>
