<script setup lang="ts">
import { useHead } from '@unhead/vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalTheme } from '@/app/cloud-portal/theme'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

usePortalTheme()
const messages = useCloudPortalMessages()
const reload = () => globalThis.location.reload()
// Its own app, without the portal's title template, so it names the product itself.
useHead({
  title: () => `${messages.value.unavailableTitle} — ${messages.value.productName}`
})
</script>

<template>
  <main class="flex h-full bg-canvas text-surface">
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
