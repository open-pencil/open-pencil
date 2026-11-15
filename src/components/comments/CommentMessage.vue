<script setup lang="ts">
import type { Color } from '@open-pencil/scene-graph/primitives'

import { COMMENT_MENTION, mentionPlugin } from '@/app/comments/mention-plugin'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'
import PersonAvatar from '@/components/presence/PersonAvatar.vue'

import { useCommentAuthor } from './author'
import CommentMention from './CommentMention.vue'
import CommentTime from './CommentTime.vue'
import { comments } from './ui'

/** One message of a thread: who wrote it, when, and what. */
const { author, color, at, text } = defineProps<{
  author: string
  color?: Color
  at: string
  text: string
}>()

defineSlots<{ actions?(): unknown }>()

const who = useCommentAuthor()
const ui = comments()
// Mentions render as names in the accent; other links stay links.
const components = { [COMMENT_MENTION]: CommentMention }
const plugins = [mentionPlugin()]
</script>

<template>
  <article data-slot="comment-message" :class="ui.message()">
    <PersonAvatar :name="who.name(author)" :color="who.color(color)" />
    <div :class="ui.messageMeta()">
      <span :class="ui.messageAuthor()">{{ who.name(author) }}</span>
      <CommentTime :at="at" :class="ui.messageTime()" />
      <span v-if="$slots.actions" :class="ui.messageActions()"><slot name="actions" /></span>
    </div>
    <MarkdownContent
      :content="text"
      :components="components"
      :plugins="plugins"
      :class="ui.messageText()"
    />
  </article>
</template>
