<script setup lang="ts">
import { useTextareaAutosize } from '@vueuse/core'
import { onMounted, ref, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'

const { text } = defineProps<{ text: string }>()
const emit = defineEmits<{ save: [text: string]; cancel: [] }>()
const { ai } = useI18n()

const draft = ref(text)
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
useTextareaAutosize({ element: textarea, input: draft, maxHeight: 200 })

onMounted(() => {
  textarea.value?.focus()
  textarea.value?.setSelectionRange(draft.value.length, draft.value.length)
})

function save(): void {
  if (draft.value.trim()) emit('save', draft.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('cancel')
  } else if (event.code === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    save()
  }
}
</script>

<template>
  <div class="w-72 max-w-full space-y-1.5" data-slot="chat-message-editor">
    <textarea
      ref="textarea"
      v-model="draft"
      rows="2"
      :aria-label="ai.editMessage"
      class="block w-full resize-none rounded-xl border border-accent bg-input px-3 py-2 text-xs leading-relaxed text-surface outline-none"
      @keydown="onKeydown"
      @copy.stop
      @cut.stop
      @paste.stop
    />
    <div class="flex justify-end gap-1">
      <AppButton size="xs" variant="ghost" @click="emit('cancel')">{{ ai.cancelEdit }}</AppButton>
      <AppButton
        size="xs"
        color="primary"
        :disabled="!draft.trim()"
        data-test-id="chat-resend"
        @click="save"
      >
        {{ ai.resendMessage }}
      </AppButton>
    </div>
  </div>
</template>
