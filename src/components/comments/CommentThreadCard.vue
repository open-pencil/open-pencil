<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'

import { liveReplies, type CommentThread } from '@open-pencil/scene-graph'
import { useCommentMessages, useCommonMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'
import { comments } from '@/theme/comments'

import CommentComposer from './CommentComposer.vue'
import CommentMessage from './CommentMessage.vue'

/** An open thread: the comment, its replies, and a reply box, as in Figma's comment card. */
const { thread } = defineProps<{ thread: CommentThread }>()

const emit = defineEmits<{
  close: []
  resolve: [threadId: string, resolved: boolean]
  reply: [threadId: string, text: string]
  deleteReply: [threadId: string, replyId: string]
}>()

defineSlots<{ menu?(): unknown }>()

const messages = useCommentMessages()
const common = useCommonMessages()
const menuCls = useMenuUI({ content: 'min-w-40' })
const ui = comments()
const replyText = ref('')
const composer = useTemplateRef<{ focus: () => void }>('composer')
const replies = computed(() => liveReplies(thread))

function sendReply(text: string) {
  emit('reply', thread.id, text)
  replyText.value = ''
}

defineExpose({ focus: () => composer.value?.focus() })
</script>

<template>
  <section
    data-slot="comment-thread"
    :data-resolved="thread.resolved || undefined"
    :aria-label="messages.comment"
    :class="ui.threadCard()"
  >
    <PanelHeader>
      <template #icon><icon-lucide-message-circle class="size-3.5" /></template>
      {{ messages.comment }}
      <template #actions>
        <DropdownMenuRoot v-if="$slots.menu" :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton :label="messages.moreActions">
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
              <slot name="menu" />
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
        <IconButton
          :label="thread.resolved ? messages.reopen : messages.resolve"
          :active="thread.resolved"
          data-command="comment-resolve"
          @click="emit('resolve', thread.id, !thread.resolved)"
        >
          <icon-lucide-circle-check-big v-if="thread.resolved" class="size-3.5" />
          <icon-lucide-circle-check v-else class="size-3.5" />
        </IconButton>
        <IconButton :label="common.close" @click="emit('close')">
          <icon-lucide-x class="size-3.5" />
        </IconButton>
      </template>
    </PanelHeader>

    <div :class="ui.thread()">
      <CommentMessage
        :author="thread.author"
        :color="thread.authorColor"
        :at="thread.createdAt"
        :text="thread.text"
      />
      <CommentMessage
        v-for="entry in replies"
        :key="entry.id"
        :author="entry.author"
        :color="entry.authorColor"
        :at="entry.createdAt"
        :text="entry.text"
      >
        <template #actions>
          <IconButton
            :label="messages.deleteReply"
            @click="emit('deleteReply', thread.id, entry.id)"
          >
            <icon-lucide-trash-2 class="size-3" />
          </IconButton>
        </template>
      </CommentMessage>
    </div>

    <div :class="ui.composerSlot()">
      <CommentComposer
        ref="composer"
        v-model="replyText"
        :label="messages.reply"
        @submit="sendReply"
        @cancel="emit('close')"
      />
    </div>
  </section>
</template>
