<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import ChatPanel from '@/components/chat/ChatPanel.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

/**
 * The AI chat over the canvas while it is shown alone, as on a board: the same chat the right
 * panel holds once the panels are open.
 */
const emit = defineEmits<{ close: [] }>()
const { editor, panels } = useI18n()
</script>

<template>
  <section
    data-test-id="floating-chat"
    :aria-label="panels.ai"
    class="absolute top-7 right-7 bottom-20 z-10 flex min-h-[min(16rem,calc(100%-1.75rem))] w-[min(360px,calc(100%-3.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
  >
    <header class="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
      <span class="flex items-center gap-1.5 text-xs font-medium text-surface">
        <icon-lucide-sparkles class="size-3.5" aria-hidden="true" />
        {{ panels.ai }}
      </span>
      <IconButton
        :label="editor.closeChat"
        data-test-id="floating-chat-close"
        @click="emit('close')"
      >
        <icon-lucide-x class="size-3.5" />
      </IconButton>
    </header>
    <ChatPanel />
  </section>
</template>
