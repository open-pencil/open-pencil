<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { cloudEditorReturnURL } from '@open-pencil/cloud/client'

import { queryClient } from '#admin/app/query/client'
import { discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const route = useRoute()
const { error } = useAsyncState(async () => {
  const discovery = await queryClient.ensureQueryData(discoveryQueryOptions())
  const destination = typeof route.query.editor === 'string' ? route.query.editor : ''
  globalThis.location.replace(cloudEditorReturnURL(discovery, destination))
}, undefined)
</script>

<template>
  <PublicShell>
    <main class="mx-auto max-w-md p-5">
      <p v-if="error" role="alert">{{ messages.errors.value.providerError }}</p>
      <p v-else role="status">{{ messages.common.value.loading }}</p>
    </main>
  </PublicShell>
</template>
