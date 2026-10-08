<script setup lang="ts">
import { computed } from 'vue'
import type { MarkdownComponentProps } from 'vue-stream-markdown'

import { useI18n } from '@open-pencil/vue'

const { node } = defineProps<MarkdownComponentProps>()
const { common } = useI18n()
// The parser marks a done task with a bound `:checked` attribute.
const checked = computed(() => node[1][':checked'] === 'true')
</script>

<template>
  <!-- A task's checkbox only reports its state; screen readers hear whether the task is done. -->
  <input
    data-stream-markdown="input"
    type="checkbox"
    class="mr-2 align-middle"
    disabled
    :checked="checked"
    :aria-label="checked ? common.taskDone : common.taskNotDone"
  />
</template>
