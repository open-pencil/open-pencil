<script setup lang="ts">
import type { Color } from '@open-pencil/scene-graph/primitives'

import { commentPreview } from '@/app/comments/format'
import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import { comments } from '@/theme/comments'

import { useCommentAuthor } from './author'
import CommentTime from './CommentTime.vue'

/**
 * A comment on the canvas: its author's avatar in a bubble pointing at the spot. Hovering opens
 * the bubble in place into the start of the comment, as in Figma.
 */
const {
  author = '',
  color,
  text = '',
  at = '',
  active = false,
  resolved = false,
  dragging = false,
  draft = false
} = defineProps<{
  author?: string
  color?: Color
  text?: string
  at?: string
  active?: boolean
  resolved?: boolean
  dragging?: boolean
  /** A comment still being written: an empty bubble, as Figma draws it. */
  draft?: boolean
}>()

const who = useCommentAuthor()
const ui = comments()
</script>

<template>
  <button
    type="button"
    data-slot="comment-pin"
    :data-active="active || undefined"
    :data-resolved="resolved || undefined"
    :data-dragging="dragging || undefined"
    :data-draft="draft || undefined"
    :class="ui.pin()"
  >
    <template v-if="!draft">
      <PersonAvatar :name="author" :color="who.color(color)" />
      <!-- An open or moving pin stays a bubble; its thread or its new place is what matters. -->
      <span v-if="text && !active && !dragging" :class="ui.pinPreview()" aria-hidden="true">
        <span :class="ui.pinPreviewClip()">
          <span :class="ui.pinPreviewBody()">
            <span :class="ui.messageMeta()">
              <span :class="ui.messageAuthor()">{{ author }}</span>
              <CommentTime v-if="at" :at="at" :class="ui.messageTime()" />
            </span>
            <span :class="ui.pinText()">{{ commentPreview(text) }}</span>
          </span>
        </span>
      </span>
    </template>
  </button>
</template>
