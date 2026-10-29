<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'

/** Where a verification link started in the editor lands: the editor finishes the sign-in. */
const portal = usePortal()
const messages = useCloudPortalMessages()
</script>

<template>
  <PortalNotice
    :host="portal.host"
    :heading="messages.verifiedTitle"
    :description="messages.verifiedDescription"
    tone="success"
  >
    <template #icon><icon-lucide-circle-check class="size-6" /></template>
  </PortalNotice>
</template>
