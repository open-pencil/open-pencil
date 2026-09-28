<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { toast, toastDuration } from '@/app/shell/ui'
import AppToast from '@/components/ui/feedback/AppToast.vue'

const { common, settings } = useI18n()
</script>

<template>
  <ToastProvider swipe-direction="up">
    <AppToast
      v-for="t in toast.toasts.value"
      :key="t.id"
      :message="t.message"
      :variant="t.variant"
      :count="t.count"
      :progress="t.progress"
      :progress-label="t.progressLabel"
      :action-label="t.action?.label"
      :duration="toastDuration(t)"
      :copyable="t.variant !== 'default'"
      :copy-label="common.copyMessage"
      :copied-label="common.copiedExclamation"
      :close-label="common.close"
      @close="toast.remove(t.id)"
      @action="t.action?.run()"
    />
    <ToastViewport
      :label="`${settings.notifications} (F8)`"
      class="fixed top-2 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-1.5"
    />
  </ToastProvider>
</template>
