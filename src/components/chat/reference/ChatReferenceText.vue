<script setup lang="ts">
import { computed } from 'vue'

import { findReferences, type ChatReference } from '@/app/ai/chat/references/link'

import ChatReferenceChip from './ChatReferenceChip.vue'

/** Plain text, such as what the person wrote, with its references shown as chips. */
const { text } = defineProps<{ text: string }>()

type Segment = { key: number; text: string } | { key: number; reference: ChatReference }

const segments = computed<Segment[]>(() => {
  const result: Segment[] = []
  let at = 0
  for (const { reference, start, end } of findReferences(text)) {
    if (start > at) result.push({ key: at, text: text.slice(at, start) })
    result.push({ key: start, reference })
    at = end
  }
  if (at < text.length) result.push({ key: at, text: text.slice(at) })
  return result
})
</script>

<template>
  <template v-for="segment in segments" :key="segment.key">
    <ChatReferenceChip v-if="'reference' in segment" :reference="segment.reference" />
    <template v-else>{{ segment.text }}</template>
  </template>
</template>
