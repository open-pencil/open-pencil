<script setup lang="ts">
import { computed } from 'vue'
import type { MarkdownComponentProps } from 'vue-stream-markdown'

import { useI18n } from '@open-pencil/vue/i18n'

const { node } = defineProps<MarkdownComponentProps>()
const { common } = useI18n()

/** The renderer passes a task item's checkbox as `["input", attributes]`, checked as a string. */
const checked = computed(() => {
  const attributes: unknown = Array.isArray(node) ? node[1] : undefined
  return (
    typeof attributes === 'object' &&
    attributes !== null &&
    ':checked' in attributes &&
    attributes[':checked'] === 'true'
  )
})
</script>

<template>
  <!-- A task list's checkbox shows a reply's state and cannot be changed; it still needs a name. -->
  <input
    data-stream-markdown="input"
    class="mr-2 align-middle task-list-item-checkbox"
    type="checkbox"
    disabled
    :checked="checked"
    :aria-label="common.task"
  />
</template>
