<script setup lang="ts">
import { computed } from 'vue'

import Tip from '@/components/ui/overlay/Tip.vue'

import type { CloudSyncState } from './types'

/** A Cloud document's sync state as one small icon, explained on hover; nothing when synced. */
const { state } = defineProps<{ state: CloudSyncState }>()

const label = computed(
  () =>
    ({
      synced: 'Saved to Cloud',
      uploading: 'Uploading changes…',
      pending: 'Changes saved on this device, waiting to upload',
      offline: 'Offline — changes are saved on this device',
      conflict: 'Edited elsewhere too — choose which version to keep',
      error: 'Could not upload changes'
    })[state]
)
</script>

<template>
  <Tip v-if="state !== 'synced'" :label="label">
    <span role="img" :aria-label="label" class="inline-flex" :data-sync="state">
      <icon-lucide-loader-circle
        v-if="state === 'uploading'"
        class="size-3 animate-spin motion-reduce:animate-none"
      />
      <icon-lucide-cloud-upload v-else-if="state === 'pending'" class="size-3" />
      <icon-lucide-cloud-off v-else-if="state === 'offline'" class="size-3" />
      <icon-lucide-git-compare-arrows
        v-else-if="state === 'conflict'"
        class="size-3 text-warning-text"
      />
      <icon-lucide-circle-alert v-else class="size-3 text-error" />
    </span>
  </Tip>
</template>
