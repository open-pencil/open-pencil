<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'

import { useLandingMessages } from '#docs/theme/landing/content/messages'
import { EDITOR_COMMANDS } from './terminal-commands'
import { useTerminalSession } from './useTerminalSession'

const messages = useLandingMessages()
const scroller = ref<HTMLElement | null>(null)

async function scrollToEnd() {
  await nextTick()
  const element = scroller.value
  if (element) element.scrollTop = element.scrollHeight
}

const { entries, busy, run } = useTerminalSession(useEditorStore(), () => void scrollToEnd())
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col bg-panel-secondary" aria-label="Terminal">
    <header
      class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 text-[11px] font-semibold text-surface"
    >
      <icon-lucide-terminal class="size-3.5 text-muted" aria-hidden="true" />
      Terminal
    </header>

    <div
      ref="scroller"
      class="scrollbar-thin min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed select-text"
      aria-live="polite"
    >
      <p v-if="entries.length === 0" class="text-muted">
        <span class="text-accent select-none">$</span> openpencil
        <span class="animate-pulse">▍</span>
      </p>
      <div v-for="entry in entries" :key="entry.id" class="mb-2 last:mb-0">
        <pre
          class="break-words whitespace-pre-wrap text-surface"
        ><span class="text-accent select-none">$ </span>{{ entry.line }}</pre>
        <pre
          v-if="entry.output"
          class="mt-1 break-words whitespace-pre-wrap text-muted data-failed:text-error"
          :data-failed="entry.failed || undefined"
          >{{ entry.output }}</pre>
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap gap-1.5 border-t border-border px-3 py-2">
      <AppButton
        v-for="command in EDITOR_COMMANDS"
        :key="command.id"
        variant="outline"
        size="xs"
        shape="pill"
        :disabled="busy"
        @click="run(command)"
      >
        <template #leading><component :is="command.icon" /></template>
        {{ messages.stage.terminal[command.id] }}
      </AppButton>
    </div>
  </section>
</template>
