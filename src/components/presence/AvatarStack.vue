<script setup lang="ts">
import { computed } from 'vue'

import { useCommonMessages } from '@open-pencil/vue'

import { avatarStack } from '@/theme/collaboration/avatar-stack'

import PersonAvatar from './PersonAvatar.vue'
import type { PresencePersonRow } from './rows'

/**
 * The people in a room or on a page, overlapping, each with how many agents they run, then
 * "+N". Interactive places wrap each person through the `person` slot and the rest through
 * `overflow`; elsewhere it is one picture named by `label`.
 */
const {
  people,
  max = 3,
  size = 'sm',
  label
} = defineProps<{
  people: PresencePersonRow[]
  max?: number
  size?: 'sm' | 'md'
  /** The stack's accessible name, when it is a picture rather than a set of controls. */
  label?: string
}>()

const common = useCommonMessages()
const ui = computed(() => avatarStack({ size }))
const shown = computed(() => people.slice(0, max))
const hidden = computed(() => people.length - shown.value.length)
</script>

<template>
  <div :class="ui.root()" :role="label ? 'img' : undefined" :aria-label="label">
    <template v-for="person in shown" :key="person.clientId ?? 'self'">
      <slot name="person" :person="person">
        <PersonAvatar
          :name="person.name || common.you"
          :color="person.color"
          :agent-count="person.agents.length"
          :size="size"
        />
      </slot>
    </template>
    <slot name="overflow" :hidden="hidden">
      <span v-if="hidden > 0" :class="ui.overflow()">+{{ hidden }}</span>
    </slot>
  </div>
</template>
