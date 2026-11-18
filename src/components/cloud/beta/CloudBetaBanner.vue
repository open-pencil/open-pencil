<script setup lang="ts">
import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { IS_OFFICIAL_CLOUD_SITE } from '@/app/cloud/availability'
import { openExternalLink } from '@/app/shell/ui'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'
import { DESKTOP_BETA_DOWNLOAD_URL } from '@/constants'

/**
 * Says the official Cloud is in beta while sign-up is open to testers, in the editor it serves on
 * its own address, and links the desktop beta, the first desktop release that works with it.
 */
const cloud = useCloudMessages()
const { common } = useI18n()
</script>

<template>
  <AppBanner
    v-if="IS_OFFICIAL_CLOUD_SITE"
    storage-key="open-pencil:cloud-beta-banner-dismissed"
    @action="openExternalLink(DESKTOP_BETA_DOWNLOAD_URL)"
  >
    {{ cloud.betaBanner }}
    <template #action>{{ cloud.betaDownload }}</template>
    <template #dismiss>{{ common.dismiss }}</template>
  </AppBanner>
</template>
