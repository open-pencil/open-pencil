<script setup lang="ts">
import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { initials } from '@/app/shell/ui'
import { avatar } from '@/theme/collaboration/avatar'
import { avatarStack } from '@/theme/collaboration/avatar-stack'

/** A person's initials on their color, with how many agents they run. */
const {
  name,
  color,
  agentCount = 0,
  size = 'sm',
  following = false,
  interactive = false
} = defineProps<{
  name: string
  color: Color
  agentCount?: number
  size?: 'sm' | 'md'
  following?: boolean
  interactive?: boolean
}>()

const ui = avatarStack()
</script>

<template>
  <span :class="ui.person()">
    <span
      :class="avatar({ size, bordered: true, following, interactive })"
      :style="{ background: colorToCSS(color) }"
    >
      {{ initials(name) }}
    </span>
    <span v-if="agentCount > 0" :class="ui.badge()" :style="{ color: colorToCSS(color) }">
      <icon-lucide-sparkle :class="ui.badgeIcon()" />{{ agentCount }}
    </span>
  </span>
</template>
