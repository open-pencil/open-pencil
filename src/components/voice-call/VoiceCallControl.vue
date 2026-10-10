<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { activeRoom } from '@/app/collab/rooms'
import { CAN_CHOOSE_SPEAKERS, SYSTEM_DEVICE, useVoiceCall } from '@/app/collab/voice/call'
import AvatarStack from '@/components/presence/AvatarStack.vue'
import type { PresencePersonRow } from '@/components/presence/rows'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { voiceCall } from '@/theme/collaboration/voice-call'

/** Everyone in the room's call, ourselves first, as the avatar stack shows them. */
const { people } = defineProps<{ people: PresencePersonRow[] }>()

const messages = useCollaborationMessages()
const call = useVoiceCall()
const inCall = computed(() => call.room.value !== null && call.room.value === activeRoom.value)
const ui = computed(() => voiceCall({ inCall: inCall.value }))
const popover = usePopoverUI({ content: voiceCall().content() })
const othersInCall = computed(() => people.filter((person) => person.clientId !== undefined))
const label = computed(() => {
  if (inCall.value) return messages.value.voiceCall
  return othersInCall.value.length > 0
    ? messages.value.joinVoiceCall
    : messages.value.startVoiceCall
})

function deviceOptions(devices: readonly MediaDeviceInfo[], fallback: string) {
  return [
    { value: SYSTEM_DEVICE, label: messages.value.systemDefault },
    ...devices
      .filter((device) => device.deviceId && device.deviceId !== SYSTEM_DEVICE)
      .map((device, index) => ({
        value: device.deviceId,
        label: device.label || `${fallback} ${index + 1}`
      }))
  ]
}
const microphones = computed(() => deviceOptions(call.microphones.value, messages.value.microphone))
const speakers = computed(() => deviceOptions(call.speakers.value, messages.value.speakers))

const failure = computed(() => {
  switch (call.error.value) {
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

function join() {
  const room = activeRoom.value
  if (room) void call.join(room)
}

function onOpenChange(open: boolean) {
  if (!open) call.dismissError()
}
</script>

<template>
  <div :class="ui.root()" data-test-id="voice-call">
    <IconButton
      v-if="inCall"
      :label="call.muted.value ? messages.unmute : messages.mute"
      :active="call.muted.value"
      side="bottom"
      data-test-id="voice-call-mute"
      @click="call.toggleMuted()"
    >
      <icon-lucide-mic-off v-if="call.muted.value" class="size-3.5" />
      <icon-lucide-mic v-else class="size-3.5" />
    </IconButton>

    <PopoverRoot @update:open="onOpenChange">
      <PopoverTrigger as-child>
        <IconButton
          :label="label"
          side="bottom"
          :class="ui.trigger()"
          data-test-id="voice-call-trigger"
        >
          <icon-lucide-chevron-down v-if="inCall" :class="ui.chevron()" />
          <icon-lucide-headphones v-else class="size-3.5" />
          <span v-if="!inCall && othersInCall.length > 0" :class="ui.count()" aria-hidden="true">
            {{ othersInCall.length }}
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
            <span :class="ui.status()" data-test-id="voice-call-status">
              {{
                people.length > 0
                  ? messages.peopleInCall({ count: String(people.length) })
                  : messages.nobodyInCall
              }}
            </span>
          </div>

          <AvatarStack
            v-if="people.length > 0"
            :people="people"
            :max="8"
            :label="messages.peopleInCall({ count: String(people.length) })"
          />

          <AppAlert
            v-if="failure && !inCall"
            tone="error"
            :heading="failure.heading"
            :description="failure.description"
            data-test-id="voice-call-error"
          />

          <template v-if="inCall">
            <label :class="ui.field()">
              <span :class="ui.label()">{{ messages.microphone }}</span>
              <AppSelect
                v-model="call.inputId.value"
                :label="messages.microphone"
                :options="microphones"
                data-test-id="voice-call-microphone"
              />
            </label>
            <label v-if="CAN_CHOOSE_SPEAKERS" :class="ui.field()">
              <span :class="ui.label()">{{ messages.speakers }}</span>
              <AppSelect
                v-model="call.outputId.value"
                :label="messages.speakers"
                :options="speakers"
                data-test-id="voice-call-speakers"
              />
            </label>
            <div :class="ui.actions()">
              <AppButton
                variant="outline"
                :class="ui.action()"
                data-test-id="voice-call-toggle-mute"
                @click="call.toggleMuted()"
              >
                <template #leading>
                  <icon-lucide-mic v-if="call.muted.value" class="size-3" />
                  <icon-lucide-mic-off v-else class="size-3" />
                </template>
                {{ call.muted.value ? messages.unmute : messages.mute }}
              </AppButton>
              <AppButton
                color="error"
                variant="soft"
                :class="ui.action()"
                data-test-id="voice-call-leave"
                @click="call.leave()"
              >
                <template #leading>
                  <icon-lucide-phone-off class="size-3" />
                </template>
                {{ messages.leaveVoiceCall }}
              </AppButton>
            </div>
          </template>

          <AppButton
            v-else
            color="primary"
            variant="solid"
            :loading="call.joining.value"
            data-test-id="voice-call-join"
            @click="join"
          >
            <template #leading>
              <icon-lucide-headphones class="size-3" />
            </template>
            {{
              call.joining.value
                ? messages.joiningVoiceCall
                : othersInCall.length > 0
                  ? messages.joinVoiceCall
                  : messages.startVoiceCall
            }}
          </AppButton>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
