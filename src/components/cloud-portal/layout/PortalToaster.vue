<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'

import { portalToast } from '@/app/cloud-portal/toast'
import AppToast from '@/components/ui/feedback/AppToast.vue'

const { common } = useI18n()
</script>

<template>
  <ToastProvider swipe-direction="up">
    <AppToast
      v-for="entry in portalToast.toasts.value"
      :key="entry.id"
      :message="entry.message"
      :variant="entry.variant"
      :duration="portalToast.duration(entry)"
      :copyable="entry.variant === 'error'"
      :copy-label="common.copyMessage"
      :copied-label="common.copiedExclamation"
      :close-label="common.close"
      @close="portalToast.remove(entry.id)"
    />
    <ToastViewport
      class="fixed top-2 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-1.5"
    />
  </ToastProvider>
</template>
