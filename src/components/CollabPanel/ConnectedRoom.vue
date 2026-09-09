<script setup lang="ts">
import { selectTarget } from '@open-pencil/vue'

import { useCollabPanelContext } from '@/components/CollabPanel/context'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-3 text-xs font-medium text-surface">{{ collab.messages.roomLink }}</div>
  <div class="mb-3 flex items-center gap-1.5">
    <AppInput
      :model-value="collab.shareURL"
      readonly
      data-test-id="collab-room-link"
      class="min-w-0 flex-1"
      @focus="selectTarget($event)"
    />
    <AppButton
      color="primary"
      variant="solid"
      data-test-id="collab-copy-link"
      @click="collab.copyLink"
    >
      <template #leading>
        <icon-lucide-check v-if="collab.copied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
      </template>
      {{ collab.copied ? 'Copied' : 'Copy' }}
    </AppButton>
  </div>

  <div class="mb-2 text-xs font-medium text-surface">
    {{ collab.peers.length + 1 }} {{ collab.peers.length === 0 ? 'person' : 'people' }} in this room
  </div>

  <AppButton
    variant="outline"
    class="w-full"
    data-test-id="collab-disconnect"
    @click="collab.disconnect"
  >
    Disconnect
  </AppButton>
</template>
