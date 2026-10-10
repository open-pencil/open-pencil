<script setup lang="ts">
import { useAIMessages } from '@open-pencil/vue'

import { useActiveEditorStoreRef, type EditorStore } from '@/app/editor/active-store'
import { followWorkingAgents } from '@/app/presence/registry'
import { appPreferences } from '@/app/settings/preferences/store'
import IconButton from '@/components/ui/button/IconButton.vue'

/**
 * Whether the view follows our AI agents while they work, from the chat's header. It acts on
 * the active tab unless a surface showing several documents names the one it belongs to.
 */
const { store } = defineProps<{ store?: EditorStore }>()
const ai = useAIMessages()
const tabStore = useActiveEditorStoreRef()

function toggle() {
  const on = !appPreferences.value.chat.followAgents
  appPreferences.value.chat.followAgents = on
  const target = store ?? tabStore.value
  if (on && target) followWorkingAgents(target)
}
</script>

<template>
  <IconButton
    :label="appPreferences.chat.followAgents ? ai.stopFollowingAgents : ai.followAgents"
    :active="appPreferences.chat.followAgents"
    size="sm"
    data-test-id="chat-follow-agents"
    @click="toggle"
  >
    <icon-lucide-locate-fixed class="size-3.5" />
  </IconButton>
</template>
