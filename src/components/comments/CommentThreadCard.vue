<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'

import type { CommentThread } from '@open-pencil/scene-graph'
import { liveReplies } from '@open-pencil/scene-graph/comments'
import { useMessages } from '@open-pencil/vue/i18n'

import type { MentionPerson } from '@/app/comments/mentions/links'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'

import CommentComposer from './CommentComposer.vue'
import CommentMessage from './CommentMessage.vue'
import { comments } from './ui'

/** An open thread: the comment, its replies, and a reply box, as in Figma's comment card. */
const {
  thread,
  readOnly = false,
  mentionable,
  canDeleteReply
} = defineProps<{
  thread: CommentThread
  /** Reading only, as a guest on a link does: no resolving, deleting, or replying. */
  readOnly?: boolean
  /** Whom a reply may name. */
  mentionable?: () => Promise<readonly MentionPerson[]>
  /** Whether a reply may be deleted here; every one where the document keeps its comments. */
  canDeleteReply?: (replyId: string) => boolean
}>()

const emit = defineEmits<{
  close: []
  resolve: [threadId: string, resolved: boolean]
  reply: [threadId: string, text: string]
  deleteReply: [threadId: string, replyId: string]
}>()

defineSlots<{ menu?(): unknown }>()

const messages = useMessages('comments')
const common = useMessages('common')
const menuCls = useMenuUI({ content: 'min-w-40' })
const ui = comments()
const replyText = ref('')
const composer = useTemplateRef<{ focus: () => void }>('composer')
const replies = computed(() => liveReplies(thread))
const deletable = (replyId: string) => canDeleteReply?.(replyId) ?? true

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
        <AppDropdownMenuRoot v-if="$slots.menu" :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton :label="messages.moreActions">
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
              <MenuScrollArea>
                <slot name="menu" />
              </MenuScrollArea>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </AppDropdownMenuRoot>
        <IconButton
          v-if="!readOnly"
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
        <template v-if="!readOnly && deletable(entry.id)" #actions>
          <IconButton
            :label="messages.deleteReply"
            @click="emit('deleteReply', thread.id, entry.id)"
          >
            <icon-lucide-trash-2 class="size-3" />
          </IconButton>
        </template>
      </CommentMessage>
    </div>

    <div v-if="!readOnly" :class="ui.composerSlot()">
      <CommentComposer
        ref="composer"
        v-model="replyText"
        :label="messages.reply"
        :mentionable="mentionable"
        @submit="sendReply"
        @cancel="emit('close')"
      />
    </div>
  </section>
</template>
