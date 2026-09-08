<script setup lang="ts">
import { AppButton, AppTextarea } from '@open-pencil/ui'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { ref, watch } from 'vue'

const open = defineModel<boolean>('open', { required: true })
const {
  title,
  description,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  requireReason = false,
  loading = false
} = defineProps<{
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  reasonLabel: string
  requireReason?: boolean
  loading?: boolean
}>()
const emit = defineEmits<{ confirm: [reason: string | undefined] }>()
const reason = ref('')

watch(open, (value) => {
  if (!value) reason.value = ''
})

function confirm(): void {
  if (requireReason && !reason.value.trim()) return
  emit('confirm', reason.value.trim() || undefined)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
      <DialogContent
        data-slot="dialog-content"
        class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-panel p-6 text-surface shadow-2xl focus:outline-none"
      >
        <DialogTitle class="text-lg font-semibold">{{ title }}</DialogTitle>
        <DialogDescription class="mt-2 text-sm leading-6 text-muted">{{
          description
        }}</DialogDescription>
        <label v-if="requireReason" class="mt-4 grid gap-1.5 text-xs font-medium">
          {{ reasonLabel }}
          <AppTextarea v-model="reason" name="reason" :rows="3" size="md" />
        </label>
        <div class="mt-6 flex justify-end gap-2">
          <DialogClose as-child>
            <AppButton variant="ghost" size="md" :disabled="loading">{{ cancelLabel }}</AppButton>
          </DialogClose>
          <AppButton
            color="error"
            variant="solid"
            size="md"
            :disabled="requireReason && !reason.trim()"
            :loading="loading"
            @click="confirm"
          >
            {{ confirmLabel }}
          </AppButton>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
