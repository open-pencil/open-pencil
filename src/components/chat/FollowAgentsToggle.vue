<script setup lang="ts">
import { useAIMessages } from '@open-pencil/vue'

import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { followWorkingAgents } from '@/app/presence/registry'
import { appPreferences } from '@/app/settings/preferences/store'
import IconButton from '@/components/ui/button/IconButton.vue'

/** Whether the view follows our AI agents while they work, from the chat's header. */
const ai = useAIMessages()
const tabStore = useActiveEditorStoreRef()

function toggle() {
  const on = !appPreferences.value.chat.followAgents
  appPreferences.value.chat.followAgents = on
  if (on && tabStore.value) followWorkingAgents(tabStore.value)
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
