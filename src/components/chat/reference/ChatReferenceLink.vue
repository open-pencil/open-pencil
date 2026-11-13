<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import { chatReference } from '@/app/ai/chat/references/link'
import { STREAMING_WORD_CLASS } from '@/app/shell/markdown/animate'
import { MARKDOWN_ANIMATING } from '@/components/markdown/context'

import ChatReferenceChip from './ChatReferenceChip.vue'

/** The `chat-reference` inline component that `referenceComponents` writes into a reply. */
const { kind, target, label } = defineProps<{ kind: string; target: string; label: string }>()

// A kind the chat does not know stays plain text.
const reference = computed(() => chatReference(kind, target, label))
// It arrives as one word of a streaming reply, so it fades in like one.
const animating = inject(MARKDOWN_ANIMATING, ref(false))
</script>

<template>
  <ChatReferenceChip
    v-if="reference"
    :reference="reference"
    :class="animating ? STREAMING_WORD_CLASS : undefined"
  />
  <span v-else>{{ label }}</span>
</template>
