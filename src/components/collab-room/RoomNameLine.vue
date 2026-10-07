<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, watch } from 'vue'

import { useCollaborationMessages, useCommonMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { roomScreen } from '@/theme/collaboration/room-screen'

/** "You'll appear as Teal Fox · Change": the name others will see, renamed in a small popover. */
const { name } = defineProps<{ name: string }>()
const emit = defineEmits<{ rename: [name: string] }>()

const messages = useCollaborationMessages()
const common = useCommonMessages()
const ui = roomScreen()
const cls = usePopoverUI({ content: 'z-50 flex w-64 flex-col gap-2 p-3' })
const open = ref(false)
const draft = ref('')

watch(open, (isOpen) => {
  if (isOpen) draft.value = name
})

function save() {
  const next = draft.value.trim()
  if (next && next !== name) emit('rename', next)
  open.value = false
}
</script>

<template>
  <p :class="ui.footnote()" data-test-id="room-name-line">
    <span>{{ messages.appearsAs({ name }) }}</span>
    <span aria-hidden="true">·</span>
    <PopoverRoot v-model:open="open">
      <PopoverTrigger as-child>
        <button type="button" :class="ui.link()" data-test-id="room-name-change">
          {{ messages.changeName }}
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent :class="cls.content" :side-offset="6" align="center">
          <label for="room-name-input" class="text-xs text-muted">{{ messages.yourName }}</label>
          <div class="flex items-center gap-1.5">
            <AppInput
              id="room-name-input"
              v-model="draft"
              autofocus
              class="min-w-0 flex-1"
              data-test-id="room-name-input"
              @enter="save"
            />
            <AppButton color="primary" variant="solid" :disabled="!draft.trim()" @click="save">
              {{ common.save }}
            </AppButton>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </p>
</template>
