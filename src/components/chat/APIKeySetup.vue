<script setup lang="ts">
import { ref } from 'vue'

import { useAIChat } from '@/composables/use-chat'

const { apiKey } = useAIChat()

const input = ref('')

function save() {
  apiKey.value = input.value.trim()
  input.value = ''
}
</script>

<template>
  <div
    data-test-id="api-key-setup"
    class="flex flex-1 flex-col items-center justify-center gap-4 px-4"
  >
    <icon-lucide-key-round class="size-8 text-muted" />
    <p class="text-center text-xs text-muted">Enter your OpenRouter API key to start chatting.</p>
    <form class="flex w-full gap-1.5" @submit.prevent="save">
      <input
        v-model="input"
        type="password"
        data-test-id="api-key-input"
        placeholder="sk-or-…"
        class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none focus:border-accent"
      />
      <button
        type="submit"
        data-test-id="api-key-save"
        class="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90"
        :disabled="!input.trim()"
      >
        Save
      </button>
    </form>
    <a
      href="https://openrouter.ai/keys"
      target="_blank"
      data-test-id="api-key-get-link"
      class="text-[10px] text-muted underline hover:text-surface"
    >
      Get an API key →
    </a>
  </div>
</template>
