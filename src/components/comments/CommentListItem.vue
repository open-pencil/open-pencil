<script setup lang="ts">
import { uniqBy } from 'es-toolkit'
import { computed } from 'vue'

import { liveReplies, type CommentThread } from '@open-pencil/scene-graph'
import { useCommentMessages } from '@open-pencil/vue'

import { commentPreview } from '@/app/comments/format'
import AvatarStack from '@/components/presence/AvatarStack.vue'
import type { PresencePersonRow } from '@/components/presence/rows'
import { comments } from '@/theme/comments'

import { useCommentAuthor } from './author'
import CommentTime from './CommentTime.vue'

/** A thread in the comments list: who took part, where it is, and how it starts. */
const {
  thread,
  number,
  pageName = '',
  active = false
} = defineProps<{
  thread: CommentThread
  /** Its place among the document's threads, as Figma numbers them. */
  number: number
  pageName?: string
  active?: boolean
}>()

const emit = defineEmits<{ select: [] }>()

defineSlots<{ actions?(): unknown }>()

const messages = useCommentMessages()
const author = useCommentAuthor()
const ui = comments()

const replies = computed(() => liveReplies(thread))
// Everyone in the thread, first to speak first; the stack keys them by position.
const people = computed<PresencePersonRow[]>(() =>
  uniqBy([thread, ...replies.value], (entry) => entry.author).map((entry, index) => ({
    clientId: index,
    name: author.name(entry.author),
    color: author.color(entry.authorColor),
    agents: []
  }))
)
</script>

<template>
  <li
    data-slot="comment-list-item"
    :data-active="active || undefined"
    :data-resolved="thread.resolved || undefined"
    :class="ui.item()"
  >
    <button type="button" :class="ui.itemButton()" @click="emit('select')">
      <span :class="ui.itemTop()">
        <AvatarStack
          :people="people"
          :max="3"
          :label="people.map((person) => person.name).join(', ')"
        />
        <span :class="ui.itemPlace()">#{{ number }} · {{ pageName }}</span>
      </span>
      <span :class="ui.itemMeta()">
        <span :class="ui.messageAuthor()">{{ author.name(thread.author) }}</span>
        <CommentTime :at="thread.createdAt" :class="ui.messageTime()" />
      </span>
      <span :class="ui.itemText()">{{ commentPreview(thread.text) }}</span>
      <span v-if="replies.length" :class="ui.itemReplies()">
        {{ messages.replyCount({ count: replies.length }) }}
      </span>
    </button>
    <span v-if="$slots.actions" :class="ui.itemActions()"><slot name="actions" /></span>
  </li>
</template>
