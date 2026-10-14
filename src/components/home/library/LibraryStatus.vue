<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, type Component } from 'vue'
import IconCloudAlert from '~icons/lucide/cloud-alert'
import IconCloudCheck from '~icons/lucide/cloud-check'
import IconCloudOff from '~icons/lucide/cloud-off'
import IconGitFork from '~icons/lucide/git-fork'
import IconHardDrive from '~icons/lucide/hard-drive'
import IconRefresh from '~icons/lucide/refresh-cw'

import { useI18n } from '@open-pencil/vue'

import { syncUIDetail, syncUIState } from '@/app/storage/sync'
import Tip from '@/components/ui/overlay/Tip.vue'
import libraryStatusTheme from '@/theme/home/library-status'

/**
 * Where the library is saved: on this device, or synced to cloud storage, and whether that sync
 * is running, waiting for the network, failing, or keeping both versions of a design that was
 * changed on another device too.
 */
const { configured, location } = defineProps<{
  /** Cloud storage is set up. */
  configured: boolean
  /** The storage provider and bucket, as the user knows them. */
  location: string
}>()

type LibraryState = 'local' | 'synced' | 'syncing' | 'offline' | 'error' | 'conflict'

const { files } = useI18n()
const styles = tv(libraryStatusTheme)
const state = computed<LibraryState>(() => {
  if (!configured) return 'local'
  return syncUIState.value === 'idle' ? 'synced' : syncUIState.value
})
const icons: Record<LibraryState, Component> = {
  local: IconHardDrive,
  synced: IconCloudCheck,
  syncing: IconRefresh,
  offline: IconCloudOff,
  error: IconCloudAlert,
  conflict: IconGitFork
}
const label = computed(() => {
  switch (state.value) {
    case 'local':
      return files.value.onThisDevice
    case 'synced':
      return files.value.syncedTo({ location })
    case 'syncing':
      return files.value.syncingTo({ location })
    case 'offline':
      return files.value.syncOffline
    case 'error':
      return files.value.syncFailed({ location })
    case 'conflict':
      return files.value.changedOnAnotherDevice
  }
})
const detail = computed(() => (state.value === 'error' ? syncUIDetail.value : null))
const variant = computed(() => styles({ state: state.value }))
</script>

<template>
  <Tip :label="detail ?? label" side="bottom">
    <span
      role="status"
      data-test-id="home-library-location"
      :data-state="state"
      :class="variant.root()"
    >
      <component :is="icons[state]" :class="variant.icon()" />
      <span :class="variant.label()">{{ label }}</span>
    </span>
  </Tip>
</template>
