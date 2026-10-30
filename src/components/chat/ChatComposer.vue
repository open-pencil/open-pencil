<script setup lang="ts">
import type { CompletionSource } from '@codemirror/autocomplete'
import type { ChatStatus } from 'ai'
import { TooltipProvider } from 'reka-ui'
import { computed, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useChatEditor } from '@/components/chat/composer/useChatEditor'
import IconButton from '@/components/ui/button/IconButton.vue'
import InputGroup from '@/components/ui/input/InputGroup.vue'

const {
  status,
  disabled = false,
  completions = [],
  takeBack
} = defineProps<{
  status: ChatStatus
  disabled?: boolean
  /** What `@` and `/` offer; read once, when the field mounts. */
  completions?: CompletionSource[]
  /** Messages waiting to be sent, taken back into the field by Up on its first line. */
  takeBack?: () => string | null
}>()
const emit = defineEmits<{
  /** `afterWork` asks, while the agent works, to wait until it has finished (Alt+Enter). */
  submit: [text: string, afterWork: boolean]
  stop: []
  /** Escape while the agent works: stop it and send what is waiting. */
  interrupt: []
  settings: []
  paste: [event: ClipboardEvent]
}>()
const { ai } = useI18n()
/** The agent is replying; messages written now wait for it, so the field stays open. */
const working = computed(() => status === 'streaming' || status === 'submitted')
const host = useTemplateRef<HTMLDivElement>('host')
const editor = useChatEditor(host, {
  label: () => ai.value.describeChange,
  placeholder: () => (working.value ? ai.value.queueMessage : ai.value.describeChange),
  editable: () => !disabled,
  attributes: { 'data-test-id': 'chat-input' },
  completions,
  onSubmit: submit,
  onCancel: () => {
    if (!working.value) return false
    emit('interrupt')
    return true
  },
  onTakeBack: () => takeBack?.() ?? null
})
const { text } = editor
/** Stop while the agent works; once something is typed, Send queues it instead. */
const showStop = computed(() => disabled || (working.value && !text.value.trim()))

function submit(afterWork = false) {
  if (disabled) return
  const message = text.value.trim()
  if (!message) return
  emit('submit', message, afterWork)
  editor.setText('')
}

function handleSubmit(event: Event) {
  event.preventDefault()
  submit()
}

/**
 * Puts back a message that could not be sent, unless something new was typed meanwhile.
 * Returns whether it did.
 */
function restoreDraft(draft: string): boolean {
  if (text.value.trim()) return false
  editor.setText(draft)
  return true
}
defineExpose({ restoreDraft, insert: editor.insert, focus: editor.focus })
</script>
<template>
  <TooltipProvider>
    <!-- The message box rests on the panel as a card, its shadow parting it from the messages. -->
    <div class="shrink-0 px-2.5 pt-1 pb-2.5">
      <form class="relative" @submit="handleSubmit" @paste.stop="emit('paste', $event)">
        <InputGroup
          :disabled="disabled"
          :ui="{ root: 'shadow-[0_1px_2px_rgb(0_0_0/0.08),0_4px_14px_rgb(0_0_0/0.12)]' }"
        >
          <template v-if="$slots.attachment" #attachment><slot name="attachment" /></template>

          <div ref="host" class="min-w-0" @copy.stop @cut.stop />

          <template #leading><slot name="leading" /></template>

          <template #model><slot name="model" /></template>

          <template #actions>
            <IconButton
              :label="ai.providerSettings"
              size="sm"
              data-test-id="provider-settings-trigger"
              @click="emit('settings')"
            >
              <icon-lucide-settings class="size-3.5" />
            </IconButton>
            <IconButton
              v-if="showStop"
              :label="ai.stopGenerating"
              size="sm"
              data-test-id="chat-stop-button"
              class="border border-border"
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </IconButton>
            <IconButton
              v-else
              :label="ai.sendMessage"
              size="sm"
              type="submit"
              data-test-id="chat-send-button"
              class="bg-accent text-on-accent hover:bg-accent/90 hover:text-on-accent"
              :disabled="!text.trim()"
            >
              <icon-lucide-send class="size-3.5" />
            </IconButton>
          </template>
        </InputGroup>
        <!-- Over the input while files are dragged onto the chat. -->
        <slot name="overlay" />
      </form>
    </div>
  </TooltipProvider>
</template>
