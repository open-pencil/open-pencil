<script setup lang="ts">
import { pickBy } from 'es-toolkit'
import { computed } from 'vue'
import type { MarkdownComponentProps } from 'vue-stream-markdown'

import { useCommonMessages } from '@open-pencil/vue'

/**
 * A Markdown task list's box, which replies show and nobody ticks, so it reads as the task's
 * state beside its text rather than as an unlabelled checkbox. Other inputs render as given.
 */
const { node } = defineProps<MarkdownComponentProps>()

const common = useCommonMessages()
// The parser writes bound values as `:name` and keeps its own bookkeeping under `$`.
const attributes = computed(() => node[1])
const isTask = computed(() => attributes.value.type === 'checkbox')
const done = computed(() => attributes.value[':checked'] === 'true')
const plainAttributes = computed(() =>
  pickBy(attributes.value, (_, name) => /^[a-z][\w-]*$/i.test(name))
)
</script>

<template>
  <span
    v-if="isTask"
    role="img"
    :aria-label="done ? common.taskDone : common.taskNotDone"
    :data-checked="done || undefined"
    data-stream-markdown="task-checkbox"
    class="me-1.5 inline-flex size-3.5 items-center justify-center rounded-sm border border-border align-[-0.125em] text-primary data-[checked]:border-transparent data-[checked]:bg-primary/15"
  >
    <icon-lucide-check v-if="done" class="size-2.5" aria-hidden="true" />
  </span>
  <input v-else v-bind="plainAttributes" />
</template>
