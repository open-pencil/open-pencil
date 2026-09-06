<script setup lang="ts">
import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import AttachmentCard from '@/components/chat/attachment/AttachmentCard.vue'

const { attachments } = defineProps<{ attachments: AttachmentPresentation[] }>()
</script>

<template>
  <div class="flex flex-wrap justify-end gap-1.5">
    <AttachmentCard
      v-for="attachment in attachments"
      :key="attachment.id"
      :attachment="attachment"
    />
  </div>
</template>
