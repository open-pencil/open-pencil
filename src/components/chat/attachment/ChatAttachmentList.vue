<script setup lang="ts">
import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import ChatAttachmentCard from '@/components/chat/attachment/ChatAttachmentCard.vue'

const { attachments } = defineProps<{ attachments: AttachmentPresentation[] }>()
</script>

<template>
  <div class="flex flex-wrap justify-end gap-1.5">
    <ChatAttachmentCard
      v-for="attachment in attachments"
      :key="attachment.id"
      :attachment="attachment"
    />
  </div>
</template>
