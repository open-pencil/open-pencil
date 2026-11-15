<script setup lang="ts">
import { comments } from './ui'

/** The `comment-mention` element `mentionPlugin` makes of a mention link: someone it names. */
const { target } = defineProps<{ target: string }>()

defineSlots<{ default?(): unknown }>()

const ui = comments()
</script>

<template>
  <span data-slot="comment-mention" :data-account="target" :class="ui.mention()"><slot /></span>
</template>
