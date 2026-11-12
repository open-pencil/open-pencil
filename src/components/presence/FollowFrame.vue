<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { isEditing } from '@open-pencil/vue/editor/keyboard'
import { useI18n } from '@open-pencil/vue/i18n'

import type { FollowedLabel } from '@/app/presence/registry'
import followFrameTheme from '@/theme/collaboration/follow-frame'

import { personFill } from './color'

const followFrame = tv(followFrameTheme)

const { followed } = defineProps<{ followed: FollowedLabel }>()
const emit = defineEmits<{ stop: [] }>()

const { collaboration: messages } = useI18n()
const ui = followFrame()

// The bar's white label reads on the followed person's color.
const color = computed(() => personFill(followed.color))
const text = computed(() =>
  followed.owner
    ? messages.value.followingAgent({ agent: followed.name, owner: followed.owner })
    : messages.value.followingPerson({ name: followed.name })
)

// Escape stops following, unless something else took it or you are typing.
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !event.defaultPrevented && !isEditing(event)) emit('stop')
})
</script>

<template>
  <div data-test-id="follow-frame" :class="ui.root()" :style="{ borderColor: color }">
    <div role="status" :class="ui.bar()" :style="{ background: color }">
      <icon-lucide-sparkle v-if="followed.kind === 'agent'" :class="ui.icon()" />
      <span :class="ui.label()">{{ text }}</span>
      <button type="button" data-test-id="follow-stop" :class="ui.stop()" @click="emit('stop')">
        {{ messages.stopFollowingShort }}
      </button>
    </div>
  </div>
</template>
