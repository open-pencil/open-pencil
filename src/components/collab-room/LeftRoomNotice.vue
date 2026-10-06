<script setup lang="ts">
import { useCollaborationMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { roomNotice } from '@/theme/collaboration/room-screen'

const emit = defineEmits<{ dismiss: [] }>()

const messages = useCollaborationMessages()
const ui = roomNotice()
</script>

<template>
  <div :class="ui.root()" role="status" data-test-id="left-room-notice">
    <icon-lucide-log-out :class="ui.icon()" aria-hidden="true" />
    <div :class="ui.content()">
      <span :class="ui.title()">{{ messages.leftRoomTitle }}</span>
      <span :class="ui.description()">{{ messages.leftRoomDescription }}</span>
    </div>
    <IconButton :label="messages.dismiss" data-test-id="left-room-dismiss" @click="emit('dismiss')">
      <icon-lucide-x class="size-3.5" />
    </IconButton>
  </div>
</template>
