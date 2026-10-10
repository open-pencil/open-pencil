<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, useId } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import type { VoiceCallError } from '@/app/collab/voice/call'
import AvatarStack from '@/components/presence/AvatarStack.vue'
import type { PresencePersonRow } from '@/components/presence/rows'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { voiceCall } from '@/theme/collaboration/voice-call'

import type { VoiceDeviceOption } from './useVoiceCallControl'

/**
 * A room's voice call beside the avatar stack: the button that starts or joins it, mute while in
 * it, and a popover with who is in it, the devices, and joining or leaving.
 */
const {
  people,
  inCall = false,
  othersInCall = 0,
  muted = false,
  joining = false,
  error = null,
  microphones,
  speakers
} = defineProps<{
  /** Everyone in the call, ourselves first. */
  people: PresencePersonRow[]
  inCall?: boolean
  /** How many other people are in the call, for the count on the button. */
  othersInCall?: number
  muted?: boolean
  joining?: boolean
  /** Why the last attempt to join failed. */
  error?: VoiceCallError | null
  microphones: VoiceDeviceOption[]
  /** Absent where the browser cannot choose speakers. */
  speakers?: VoiceDeviceOption[]
}>()

const microphone = defineModel<string>('microphone', { required: true })
const speaker = defineModel<string>('speaker', { required: true })

const emit = defineEmits<{
  join: []
  toggleMute: []
  leave: []
  /** The popover closed, so a failure it showed is done with. */
  close: []
}>()

const messages = useCollaborationMessages()
const microphoneId = useId()
const speakerId = useId()
const ui = computed(() => voiceCall({ inCall }))
const popover = usePopoverUI({ content: voiceCall().content() })

const triggerLabel = computed(() => {
  if (inCall) return messages.value.voiceCall
  return othersInCall > 0 ? messages.value.joinVoiceCall : messages.value.startVoiceCall
})
const joinLabel = computed(() => (joining ? messages.value.joiningVoiceCall : triggerLabel.value))
const muteLabel = computed(() => (muted ? messages.value.unmute : messages.value.mute))
const status = computed(() =>
  people.length > 0
    ? messages.value.peopleInCall({ count: String(people.length) })
    : messages.value.nobodyInCall
)

const failure = computed(() => {
  switch (error) {
    case 'denied':
      return {
        heading: messages.value.voiceDeniedTitle,
        description: messages.value.voiceDeniedDescription
      }
    case 'no-microphone':
      return {
        heading: messages.value.voiceNoMicrophoneTitle,
        description: messages.value.voiceNoMicrophoneDescription
      }
    case 'unavailable':
      return {
        heading: messages.value.voiceUnavailableTitle,
        description: messages.value.voiceUnavailableDescription
      }
    case 'unsupported':
      return {
        heading: messages.value.voiceUnsupportedTitle,
        description: messages.value.voiceUnsupportedDescription
      }
    default:
      return null
  }
})

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <div :class="ui.root()" data-test-id="voice-call">
    <IconButton
      v-if="inCall"
      :label="muteLabel"
      :active="muted"
      side="bottom"
      @click="emit('toggleMute')"
    >
      <icon-lucide-mic-off v-if="muted" class="size-3.5" />
      <icon-lucide-mic v-else class="size-3.5" />
    </IconButton>

    <PopoverRoot @update:open="onOpenChange">
      <PopoverTrigger as-child>
        <IconButton :label="triggerLabel" side="bottom" :class="ui.trigger()">
          <icon-lucide-chevron-down v-if="inCall" :class="ui.chevron()" />
          <icon-lucide-headphones v-else class="size-3.5" />
          <span v-if="!inCall && othersInCall > 0" :class="ui.count()" aria-hidden="true">
            {{ othersInCall }}
          </span>
        </IconButton>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          :class="popover.content"
          :side-offset="8"
          side="bottom"
          align="end"
          data-test-id="voice-call-popover"
        >
          <div :class="ui.header()">
            <span :class="ui.title()">{{ messages.voiceCall }}</span>
            <span :class="ui.status()">{{ status }}</span>
          </div>

          <AvatarStack v-if="people.length > 0" :people="people" :max="8" :label="status" />

          <AppAlert
            v-if="failure && !inCall"
            tone="error"
            :heading="failure.heading"
            :description="failure.description"
          />

          <!-- Chosen before joining too, so a microphone that will not open can be swapped. -->
          <PanelFieldGroup :label="messages.microphone" :for="microphoneId">
            <AppSelect
              :id="microphoneId"
              v-model="microphone"
              :label="messages.microphone"
              :options="microphones"
            />
          </PanelFieldGroup>
          <PanelFieldGroup v-if="speakers" :label="messages.speakers" :for="speakerId">
            <AppSelect
              :id="speakerId"
              v-model="speaker"
              :label="messages.speakers"
              :options="speakers"
            />
          </PanelFieldGroup>

          <div v-if="inCall" :class="ui.actions()">
            <AppButton variant="outline" :class="ui.action()" @click="emit('toggleMute')">
              <template #leading>
                <icon-lucide-mic v-if="muted" class="size-3" />
                <icon-lucide-mic-off v-else class="size-3" />
              </template>
              {{ muteLabel }}
            </AppButton>
            <AppButton color="error" variant="soft" :class="ui.action()" @click="emit('leave')">
              <template #leading>
                <icon-lucide-phone-off class="size-3" />
              </template>
              {{ messages.leaveVoiceCall }}
            </AppButton>
          </div>
          <AppButton
            v-else
            color="primary"
            variant="solid"
            :loading="joining"
            @click="emit('join')"
          >
            <template #leading>
              <icon-lucide-headphones class="size-3" />
            </template>
            {{ joinLabel }}
          </AppButton>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
