<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortalTheme } from '@/app/cloud-portal/theme'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

usePortalTheme()
const messages = useCloudPortalMessages()
const reload = () => globalThis.location.reload()
</script>

<template>
  <main class="flex h-full bg-app text-surface">
    <AppPlaceholder
      size="page"
      label-as="h1"
      :label="messages.unavailableTitle"
      :description="messages.unavailableDescription"
    >
      <template #icon><icon-lucide-cloud-off class="size-5" /></template>
      <template #action>
        <AppButton variant="outline" @click="reload">
          {{ messages.tryAgain }}
        </AppButton>
      </template>
    </AppPlaceholder>
  </main>
</template>
