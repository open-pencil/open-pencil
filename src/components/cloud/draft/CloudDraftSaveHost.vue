<script setup lang="ts">
import { computed } from 'vue'

import { cloudDraftSave, keepDraftInCloud, saveDraftOnDevice } from '@/app/cloud/drafts/save'
import { cloudServerHost } from '@/app/cloud/servers/address'
import { findCloudServer } from '@/app/cloud/servers/store'

import CloudDraftSaveDialog from './CloudDraftSaveDialog.vue'

/** The one Keep this file dialog, for Save without an account on a Cloud server's editor. */
const host = computed(() => {
  const server = cloudDraftSave.value ? findCloudServer(cloudDraftSave.value.serverId) : null
  return server ? cloudServerHost(server.url) : ''
})
const open = computed({
  get: () => cloudDraftSave.value !== null,
  set: (value) => {
    if (!value) cloudDraftSave.value = null
  }
})
</script>

<template>
  <CloudDraftSaveDialog
    v-model:open="open"
    :host="host"
    @sign-up="keepDraftInCloud('sign-up')"
    @sign-in="keepDraftInCloud('sign-in')"
    @save-on-device="saveDraftOnDevice"
  />
</template>
