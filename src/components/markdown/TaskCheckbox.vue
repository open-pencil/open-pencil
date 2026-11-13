<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

/** Comark writes a task item's state as the `:checked` attribute, which arrives as a boolean. */
const { checked = false } = defineProps<{ checked?: boolean }>()
const { common } = useI18n()
</script>

<template>
  <!-- A task list's checkbox shows a reply's state and cannot be changed; it still needs a name. -->
  <input
    data-markdown="task-checkbox"
    class="me-2 align-middle"
    type="checkbox"
    disabled
    :checked="checked"
    :aria-label="common.task"
  />
</template>
