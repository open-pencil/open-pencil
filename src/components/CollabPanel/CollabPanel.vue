<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import CollabAvatarStack from '@/components/CollabPanel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/CollabPanel/CollabSharePopover.vue'
import ShareModal from '@/components/ShareModal.vue'
import { provideCollabPanel } from '@/components/CollabPanel/context'

provideCollabPanel()

const route = useRoute()
const shareOpen = ref(false)
const boardId = computed(() => {
  // /board/:id route の :id を優先、 無ければ ?board= クエリ (旧形式 backward compat)
  const paramId = route.params.id
  if (typeof paramId === 'string' && paramId.length > 0) return paramId
  return typeof route.query.board === 'string' && route.query.board.length > 0
    ? route.query.board
    : null
})
const boardName = computed(() => (typeof route.query.name === 'string' ? route.query.name : 'Board'))
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <CollabAvatarStack />
    <div class="flex-1" />
    <button
      type="button"
      data-test-id="invite-share-button"
      class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!boardId"
      @click="shareOpen = true"
    >
      共有
    </button>
    <CollabSharePopover />
    <ShareModal v-model:open="shareOpen" :board-id="boardId" :board-name="boardName" />
  </div>
</template>
