<script setup lang="ts">
import { computed } from 'vue'

import { chatReference } from '@/app/ai/chat/references/link'

import ChatReferenceChip from './ChatReferenceChip.vue'

/** The `chat-reference` inline component that `referenceComponents` writes into a reply. */
const { kind, target, label } = defineProps<{ kind: string; target: string; label: string }>()

// A kind the chat does not know stays plain text.
const reference = computed(() => chatReference(kind, target, label))
</script>

<template>
  <ChatReferenceChip v-if="reference" :reference="reference" />
  <span v-else>{{ label }}</span>
</template>
