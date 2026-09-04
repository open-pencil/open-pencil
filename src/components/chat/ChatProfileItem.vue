<script setup lang="ts">
import type { AIModelProfile } from '@/app/ai/models'

import { chatProfileTheme } from '@/theme/chat/profile'

const { profile, metadata } = defineProps<{
  profile: AIModelProfile
  metadata: string
}>()

const ui = chatProfileTheme()
</script>

<template>
  <span class="contents">
    <span :class="ui.text()">
      <span :class="ui.name()">{{ profile.name }}</span>
      <span :class="ui.metadata()">{{ metadata }}</span>
    </span>
    <span
      :class="ui.capability()"
      :aria-label="profile.capabilities.includes('vision') ? 'Supports image input' : undefined"
    >
      <icon-lucide-eye
        v-if="profile.capabilities.includes('vision')"
        class="size-full"
        aria-hidden="true"
      />
    </span>
  </span>
</template>
