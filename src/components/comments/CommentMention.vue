<script setup lang="ts">
import { comments } from './ui'

/** The `comment-mention` inline component `mentionComponents` writes: someone a comment names. */
const { target, label } = defineProps<{ target: string; label: string }>()

const ui = comments()
</script>

<template>
  <span data-slot="comment-mention" :data-account="target" :class="ui.mention()">{{ label }}</span>
</template>
