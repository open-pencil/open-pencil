<script setup lang="ts">
import {
  cloudSaveDestination,
  cloudSaveDestinations,
  cloudSaveName,
  cloudSaveOpen,
  cloudSaveState,
  saveToCloud
} from '@/app/cloud/documents/save'

import CloudSaveDialog from './CloudSaveDialog.vue'

/** The Save to Cloud dialog, driven by the app's save flow for whichever tab opened it. */
</script>

<template>
  <CloudSaveDialog
    v-model:open="cloudSaveOpen"
    v-model:name="cloudSaveName"
    v-model:destination="cloudSaveDestination"
    :destinations="cloudSaveDestinations"
    :state="cloudSaveState"
    @save="saveToCloud"
    @cancel="cloudSaveOpen = false"
  />
</template>
