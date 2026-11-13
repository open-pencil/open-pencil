<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import IconButton from '@/components/ui/button/IconButton.vue'

/** Follows a subagent's cursor, or stops; the chat's Follow agents toggle uses the same icon. */
const { name, following } = defineProps<{ name: string; following: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { ai } = useI18n()
</script>

<template>
  <IconButton
    :label="following ? ai.stopFollowingSubagent({ name }) : ai.followSubagent({ name })"
    :active="following"
    size="sm"
    data-test-id="chat-subagent-follow"
    @click.stop="emit('toggle')"
  >
    <icon-lucide-locate-fixed class="size-3.5" />
  </IconButton>
</template>
