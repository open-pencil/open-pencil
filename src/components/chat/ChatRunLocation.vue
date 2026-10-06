<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'

const { agent, page } = defineProps<{ agent: string; page: string }>()
const emit = defineEmits<{ open: [] }>()

const { ai } = useI18n()
</script>

<template>
  <p
    role="status"
    data-test-id="chat-run-location"
    class="flex items-center gap-2 px-3 py-1.5 text-xs text-muted"
  >
    <span class="min-w-0 flex-1 truncate">{{ ai.chatAgentWorkingOn({ agent, page }) }}</span>
    <AppButton size="xs" variant="link" @click="emit('open')">{{ ai.chatGoToPage }}</AppButton>
  </p>
</template>
