<script setup lang="ts">
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-3">
    <label class="mb-1 block text-xs text-muted">{{ collab.messages.yourName }}</label>
    <AppInput
      v-model="collab.nameDraft"
      data-test-id="collab-name-input"
      :placeholder="collab.messages.enterYourName"
      @enter="collab.share"
    />
  </div>

  <AppButton
    size="md"
    color="primary"
    variant="solid"
    class="mb-3 w-full"
    data-test-id="collab-share-file"
    :disabled="!collab.nameDraft.trim()"
    @click="collab.share"
  >
    <template #leading><icon-lucide-share-2 class="size-3.5" /></template>
    {{ collab.messages.shareThisFile }}
  </AppButton>

  <div class="mb-2 flex items-center gap-2">
    <div class="h-px flex-1 bg-border" />
    <span class="text-[11px] text-muted">{{ collab.messages.orJoinRoom }}</span>
    <div class="h-px flex-1 bg-border" />
  </div>

  <div class="flex items-center gap-1.5">
    <AppInput
      v-model="collab.joinInput"
      data-test-id="collab-join-input"
      :placeholder="collab.messages.pasteRoomLinkOrId"
      class="min-w-0 flex-1"
      @enter="collab.join"
    />
    <AppButton
      color="primary"
      variant="solid"
      data-test-id="collab-join-room-button"
      :disabled="!collab.joinInput.trim() || !collab.nameDraft.trim()"
      @click="collab.join"
    >
      Join
    </AppButton>
  </div>
</template>
