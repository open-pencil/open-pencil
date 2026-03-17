<script setup lang="ts">
import { ToastProvider, ToastRoot, ToastDescription, ToastViewport, ToastClose } from 'reka-ui'

import { useClipboard } from '@vueuse/core'

import Tip from '@/components/Tip.vue'
import { toast } from '@/utils/toast'
import { toastRoot } from '@/components/ui/toast'

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
</script>

<template>
  <ToastProvider swipe-direction="up">
    <ToastRoot
      v-for="t in toast.toasts.value"
      :key="t.id"
      data-test-id="toast-item"
      :duration="t.variant === 'error' ? 0 : toast.TOAST_DURATION"
      :class="toastRoot({ tone: t.variant })"
      @update:open="
        (open) => {
          if (!open) toast.remove(t.id)
        }
      "
    >
      <icon-lucide-check v-if="t.variant === 'default'" class="mt-0.5 size-3 shrink-0" />
      <icon-lucide-triangle-alert v-else class="mt-0.5 size-3 shrink-0" />
      <ToastDescription class="min-w-0 flex-1 select-text">{{ t.message }}</ToastDescription>
      <Tip v-if="t.variant === 'error'" :label="copied ? 'Copied!' : 'Copy error'">
        <button
          data-test-id="toast-copy-error"
          class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100"
          @click="copy(t.message)"
        >
          <icon-lucide-check v-if="copied" class="size-3" />
          <icon-lucide-copy v-else class="size-3" />
        </button>
      </Tip>
      <ToastClose
        v-if="t.variant === 'error'"
        data-test-id="toast-close"
        class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100"
      >
        <icon-lucide-x class="size-3" />
      </ToastClose>
    </ToastRoot>

    <ToastViewport
      class="fixed top-2 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-1.5"
    />
  </ToastProvider>
</template>
