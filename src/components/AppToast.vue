<script setup lang="ts">
import { ToastProvider, ToastRoot, ToastDescription, ToastViewport, ToastClose } from 'reka-ui'

import { useClipboard } from '@vueuse/core'

import Tip from '@/components/ui/Tip.vue'
import { toast } from '@/app/shell/ui'
import { useToastUI } from '@/components/ui/toast'

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
</script>

<template>
  <ToastProvider swipe-direction="up">
    <ToastRoot
      v-for="t in toast.toasts.value"
      :key="t.id"
      data-test-id="toast-item"
      :duration="t.variant === 'error' ? toast.ERROR_TOAST_DURATION : toast.TOAST_DURATION"
      :class="useToastUI({ tone: t.variant }).base"
      @update:open="
        (open) => {
          if (!open) toast.remove(t.id)
        }
      "
    >
      <icon-lucide-check v-if="t.variant === 'default'" class="mt-0.5 size-3 shrink-0" />
      <icon-lucide-triangle-alert v-else class="mt-0.5 size-3 shrink-0" />
      <ToastDescription class="min-w-0 flex-1 select-text">
        {{ t.message }}<span v-if="t.count > 1" class="ml-1.5 opacity-70">×{{ t.count }}</span>
      </ToastDescription>
      <Tip v-if="t.variant !== 'default'" :label="copied ? 'Copied!' : 'Copy message'">
        <button
          data-test-id="toast-copy-message"
          class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100"
          @click="copy(t.message)"
        >
          <icon-lucide-check v-if="copied" class="size-3" />
          <icon-lucide-copy v-else class="size-3" />
        </button>
      </Tip>
      <ToastClose
        v-if="t.variant !== 'default'"
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
