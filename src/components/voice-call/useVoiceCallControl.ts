import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { activeRoom } from '@/app/collab/rooms'
import { CAN_CHOOSE_SPEAKERS, SYSTEM_DEVICE, useVoiceCall } from '@/app/collab/voice/call'
import type { PresencePersonRow } from '@/components/presence/rows'

/** A microphone or speaker as the call's pickers list it. */
export interface VoiceDeviceOption {
  value: string
  label: string
}

/**
 * The active tab's room call as the call control shows it: whether we are in it, who else is,
 * the devices to pick from, and joining it. `people` is everyone in the call, ourselves first.
 */
export function useVoiceCallControl(people: MaybeRefOrGetter<readonly PresencePersonRow[]>) {
  const messages = useCollaborationMessages()
  const call = useVoiceCall()

  const inCall = computed(() => call.room.value !== null && call.room.value === activeRoom.value)
  const othersInCall = computed(
    () => toValue(people).filter((person) => person.clientId !== undefined).length
  )

  function deviceOptions(devices: readonly MediaDeviceInfo[], fallback: string) {
    return [
      { value: SYSTEM_DEVICE, label: messages.value.systemDefault },
      // Before permission browsers list devices without IDs or names; those cannot be chosen.
      ...devices
        .filter((device) => device.deviceId && device.deviceId !== SYSTEM_DEVICE)
        .map((device, index) => ({
          value: device.deviceId,
          label: device.label || `${fallback} ${index + 1}`
        }))
    ] satisfies VoiceDeviceOption[]
  }

  return {
    inCall,
    othersInCall,
    muted: call.muted,
    joining: call.joining,
    error: call.error,
    microphone: call.inputId,
    speaker: call.outputId,
    microphones: computed(() => deviceOptions(call.microphones.value, messages.value.microphone)),
    speakers: computed(() =>
      CAN_CHOOSE_SPEAKERS ? deviceOptions(call.speakers.value, messages.value.speakers) : undefined
    ),
    join() {
      const room = activeRoom.value
      if (room) void call.join(room)
    },
    toggleMuted: call.toggleMuted,
    leave: call.leave,
    dismissError: call.dismissError
  }
}
