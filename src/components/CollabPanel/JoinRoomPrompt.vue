<script setup lang="ts">
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-1 text-xs font-medium text-surface">{{ collab.messages.joinCollaboration }}</div>
  <div class="mb-3 text-[11px] text-muted">
    Someone shared this file with you. Enter your name to join.
  </div>

  <div class="mb-3">
    <label class="mb-1 block text-xs text-muted">{{ collab.messages.yourName }}</label>
    <AppInput
      v-model="collab.nameDraft"
      data-test-id="collab-name-input"
      :placeholder="collab.messages.enterYourName"
      autofocus
      @enter="collab.join"
    />
  </div>

  <AppButton
    size="md"
    color="primary"
    variant="solid"
    class="w-full"
    data-test-id="collab-join-button"
    :disabled="!collab.nameDraft.trim()"
    @click="collab.join"
  >
    <template #leading><icon-lucide-users class="size-3.5" /></template>
    Join room
  </AppButton>
</template>
