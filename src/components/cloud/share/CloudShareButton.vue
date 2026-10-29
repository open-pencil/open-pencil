<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { cloudShareOpen } from '@/app/cloud/sharing/dialog'
import { cloudShareTarget } from '@/app/cloud/sharing/document'
import { useEditorStore } from '@/app/editor/active-store'
import { shareButton } from '@/components/collab-panel/ui'

/** Opens the Cloud document's share dialog, which `CloudShareHost` shows for the app. */
const store = useEditorStore()
const { collaboration } = useI18n()
const target = computed(() => {
  const binding = store.getStorageBinding()
  return binding ? cloudShareTarget(binding) : null
})
</script>

<template>
  <button
    data-test-id="cloud-share-button"
    :class="shareButton({ connection: 'idle' })"
    :disabled="!target"
    @click="cloudShareOpen = true"
  >
    <icon-lucide-share-2 class="size-3.5" />
    {{ collaboration.share }}
  </button>
</template>
