<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { useJoinRoom } from '@/app/collab/join'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'

/** "Join room…" on Home: paste a room link or ID to open someone's shared file in a new tab. */
const { size = 'md' } = defineProps<{ size?: 'md' | 'lg' }>()

const messages = useCollaborationMessages()
const joinRoomFromInput = useJoinRoom()
const cls = usePopoverUI({ content: 'z-50 flex w-80 flex-col gap-2 p-3' })
const open = ref(false)
const input = ref('')
const invalid = ref(false)
const ERROR_ID = 'home-join-room-error'

function join() {
  if (!joinRoomFromInput(input.value)) {
    invalid.value = true
    return
  }
  input.value = ''
  invalid.value = false
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <AppButton :size="size" variant="outline" data-test-id="home-join-room">
        <template #leading><icon-lucide-users class="size-3.5" /></template>
        {{ messages.joinRoomEllipsis }}
      </AppButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="cls.content"
        :side-offset="8"
        align="end"
        data-test-id="home-join-room-popover"
      >
        <p class="text-xs text-muted">{{ messages.joinRoomDescription }}</p>
        <div class="flex items-center gap-1.5">
          <AppInput
            v-model="input"
            autofocus
            data-test-id="home-join-room-input"
            class="min-w-0 flex-1"
            :placeholder="messages.pasteRoomLinkOrId"
            :aria-label="messages.pasteRoomLinkOrId"
            :state="invalid ? 'invalid' : 'idle'"
            :aria-invalid="invalid"
            :aria-describedby="invalid ? ERROR_ID : undefined"
            @update:model-value="invalid = false"
            @enter="join"
          />
          <AppButton
            color="primary"
            variant="solid"
            data-test-id="home-join-room-submit"
            :disabled="!input.trim()"
            @click="join"
          >
            {{ messages.join }}
          </AppButton>
        </div>
        <p v-if="invalid" :id="ERROR_ID" class="text-xs text-error" role="alert">
          {{ messages.invalidRoomLink }}
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
