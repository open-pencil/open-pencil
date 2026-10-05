<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import { useI18n } from '@open-pencil/vue'

import type { FollowedLabel } from '@/app/presence/registry'
import { isEditing } from '@/app/shell/keyboard/focus'
import { followFrame } from '@/theme/collaboration/follow-frame'

const { followed } = defineProps<{ followed: FollowedLabel }>()
const emit = defineEmits<{ stop: [] }>()

const { collaboration: messages } = useI18n()
const ui = followFrame()

const color = computed(() => colorToCSS(followed.color))
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
