<script setup lang="ts">
import CommentTime from '@/components/comments/CommentTime.vue'

import { cloudVersions } from './ui'

/**
 * An entry on the history's timeline. A named version shows a ring, an autosave a dot, as in
 * Figma; the line runs on to the next entry unless this is the last one.
 */
const {
  label,
  description = null,
  author = null,
  at = null,
  named = false,
  selected = false,
  last = false,
  current = false
} = defineProps<{
  label: string
  description?: string | null
  author?: string | null
  at?: string | null
  named?: boolean
  selected?: boolean
  last?: boolean
  /** The Current version entry, which names the document as it is now. */
  current?: boolean
}>()

const emit = defineEmits<{ select: [] }>()
defineSlots<{ actions?(): unknown }>()

const ui = cloudVersions()
</script>

<template>
  <li data-slot="version-list-item" :data-selected="selected || undefined" :class="ui.item()">
    <button
      type="button"
      :class="ui.itemButton()"
      :data-selected="selected || undefined"
      :aria-current="selected || undefined"
      @click="emit('select')"
    >
      <span :class="ui.marker()" aria-hidden="true">
        <span v-if="!last" :class="ui.line()" />
        <span :class="named || current ? ui.ring() : ui.dot()" />
      </span>
      <span :class="ui.body()">
        <span :class="current ? ui.current() : ui.title()">{{ label }}</span>
        <span v-if="description" :class="ui.description()">{{ description }}</span>
        <span v-if="author" :class="ui.author()">{{ author }}</span>
        <CommentTime v-if="at && named" :at="at" :class="ui.time()" />
      </span>
    </button>
    <span v-if="$slots.actions" :class="ui.actions()"><slot name="actions" /></span>
  </li>
</template>
