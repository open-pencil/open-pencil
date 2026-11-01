<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'

import { chatContextTheme } from './ui'

/** Over the message field once the context is nearly full, with a way to compact it now. */
const { percent, compacting = false } = defineProps<{ percent: number; compacting?: boolean }>()
const emit = defineEmits<{ compact: [] }>()
const { ai } = useI18n()
const ui = chatContextTheme()
</script>

<template>
  <div :class="ui.warning()" role="status" data-test-id="chat-context-warning">
    <icon-lucide-gauge class="size-3.5 shrink-0" aria-hidden="true" />
    <span :class="ui.warningLabel()">
      {{ compacting ? ai.compacting : ai.contextNearlyFull({ percent }) }}
    </span>
    <AppButton v-if="!compacting" size="xs" variant="ghost" @click="emit('compact')">
      {{ ai.compact }}
    </AppButton>
  </div>
</template>
