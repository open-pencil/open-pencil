<script setup lang="ts">
import { usePortal } from '@/app/cloud-portal/context'
import { usePortalLoad } from '@/app/cloud-portal/state'

import PortalStatus from '../console/PortalStatus.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'
import type { PortalServerStatus } from '../types'

const emit = defineEmits<{ open: [section: 'requests' | 'email'] }>()
const portal = usePortal()
const overview = usePortalLoad<PortalServerStatus | null>(() => portal.api.operations(), null)
</script>

<template>
  <!-- A failed refresh says so above the status it last read, which stays. -->
  <div class="flex flex-col gap-4" :aria-busy="overview.loading.value || undefined">
    <PortalLoadAlert
      v-if="overview.error.value"
      :error="overview.error.value"
      @retry="overview.reload()"
    />
    <PortalStatus
      v-if="overview.data.value"
      :status="overview.data.value"
      @open="(section) => emit('open', section)"
    />
    <PortalPageSkeleton v-else-if="overview.status.value === 'loading'" :groups="[3, 3, 3]" />
  </div>
</template>
