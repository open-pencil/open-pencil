<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useChatEditor } from '@/components/chat/composer/useChatEditor'
import { useComposerCompletions } from '@/components/chat/composer/useComposerCompletions'
import AppButton from '@/components/ui/button/AppButton.vue'

const { text: initial } = defineProps<{ text: string }>()
const emit = defineEmits<{ save: [text: string]; cancel: [] }>()
const { ai } = useI18n()

/** The composer's field, so a sent message edits with the same chips and completions. */
const host = useTemplateRef<HTMLDivElement>('host')
const editor = useChatEditor(host, {
  initial,
  label: () => ai.value.editMessage,
  placeholder: () => '',
  editable: () => true,
  attributes: {},
  completions: useComposerCompletions(),
  onSubmit: save,
  onCancel: () => {
    emit('cancel')
    return true
  }
})
const { text: draft } = editor

onMounted(() => editor.focusEnd())

function save(): void {
  if (draft.value.trim()) emit('save', draft.value)
}
</script>

<template>
  <div class="w-72 max-w-full space-y-1.5" data-slot="chat-message-editor">
    <div
      ref="host"
      class="rounded-xl border border-accent bg-input"
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
