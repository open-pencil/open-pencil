<script setup lang="ts">
import { useCollabPanelContext } from '@/components/collab-panel/context'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const collab = useCollabPanelContext()
const JOIN_ERROR_ID = 'collab-join-error'
</script>

<template>
  <div class="mb-3">
    <label for="collab-name-input" class="mb-1 block text-xs text-muted">
      {{ collab.messages.yourName }}
    </label>
    <AppInput
      id="collab-name-input"
      v-model="collab.nameDraft"
      data-test-id="collab-name-input"
      :placeholder="collab.state.localName"
      @enter="collab.share"
    />
  </div>

  <AppButton
    size="md"
    color="primary"
    variant="solid"
    class="mb-3 w-full"
    data-test-id="collab-share-file"
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
      :aria-label="collab.messages.pasteRoomLinkOrId"
      :state="collab.joinError ? 'invalid' : 'idle'"
      :aria-invalid="collab.joinError"
      :aria-describedby="collab.joinError ? JOIN_ERROR_ID : undefined"
      class="min-w-0 flex-1"
      @update:model-value="collab.clearJoinError"
      @enter="collab.join"
    />
    <AppButton
      color="primary"
      variant="solid"
      data-test-id="collab-join-room-button"
      :disabled="!collab.joinInput.trim()"
      @click="collab.join"
    >
      {{ collab.messages.join }}
    </AppButton>
  </div>
  <p
    v-if="collab.joinError"
    :id="JOIN_ERROR_ID"
    data-test-id="collab-join-error"
    class="mt-1.5 text-xs text-error"
    role="alert"
  >
    {{ collab.messages.invalidRoomLink }}
  </p>
</template>
