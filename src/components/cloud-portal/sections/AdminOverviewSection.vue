<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalStatus from '../console/PortalStatus.vue'
import type { PortalServerStatus } from '../types'

const emit = defineEmits<{ open: [section: 'requests' | 'email'] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const failures = usePortalFailureMessages()
const status = shallowRef<PortalServerStatus | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    status.value = await portal.api.operations()
  } catch (cause) {
    error.value = failures.api(cause)
  }
})
</script>

<template>
  <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
  <PortalStatus v-else-if="status" :status="status" @open="(section) => emit('open', section)" />
</template>
