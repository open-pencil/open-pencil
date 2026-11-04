<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import IconCheck from '~icons/lucide/check'
import IconCopy from '~icons/lucide/copy'

import { useLandingMessages } from '../content/messages'
import { COPIED_MS } from '../ui/copy'

/** A shell command to paste into a terminal, with a button that copies it. */
const { command } = defineProps<{ command: string }>()

const messages = useLandingMessages()
const clipboard = useClipboard({ copiedDuring: COPIED_MS })
</script>

<template>
  <div class="command">
    <code>{{ command }}</code>
    <button
      type="button"
      :aria-label="clipboard.copied.value ? messages.clipboard.copied : messages.clipboard.copy"
      :data-copied="clipboard.copied.value || undefined"
      @click="clipboard.copy(command)"
    >
      <IconCheck v-if="clipboard.copied.value" aria-hidden="true" />
      <IconCopy v-else aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.command {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 4px 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}

code {
  min-width: 0;
  overflow-x: auto;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: nowrap;
  scrollbar-width: none;
}

button {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-left: auto;
  border-radius: 7px;
  color: var(--vp-c-text-2);
  transition:
    color 0.2s,
    background-color 0.2s;
}

button:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

button[data-copied] {
  color: var(--vp-c-brand-1);
}

button svg {
  width: 14px;
  height: 14px;
}
</style>
