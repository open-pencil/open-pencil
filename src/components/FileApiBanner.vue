<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { supportsFileSystemAccess } from '@/app/document/io/capability'
import ExternalLink from '@/components/links/ExternalLink.vue'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'
import { IS_TAURI } from '@/constants'

/** Neutral capability reference: the File System Access API support table. */
const supportURL = 'https://caniuse.com/native-filesystem-api'

const { files, common } = useI18n()
const show = !IS_TAURI && !supportsFileSystemAccess()
</script>

<template>
  <AppBanner v-if="show" test-id="safari-banner" storage-key="safari-banner-dismissed">
    {{ files.browserFileAPINotSupported }}
    <ExternalLink :href="supportURL" class="ml-1">{{ common.browserSupport }}</ExternalLink>
    <template #dismiss>{{ common.dismiss }}</template>
  </AppBanner>
</template>
