import { useDevicesList, useLocalStorage, useUserMedia } from '@vueuse/core'
import { computed, effectScope, ref, shallowRef, watch } from 'vue'

import type { RoomSession } from '@/app/collab/session'

/** Why joining a call failed, for the guidance shown with it. */
export type VoiceCallError = 'unsupported' | 'denied' | 'no-microphone' | 'unavailable'

/** Browsers pick speakers per audio element only where `setSinkId` exists (Safari 18.4+). */
export const CAN_CHOOSE_SPEAKERS =
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

/** The device the system picks, as Chromium names it; other browsers list no such device. */
export const SYSTEM_DEVICE = 'default'

function createVoiceCall() {
  // Device IDs are per browser and origin, so the choice is a per-device convenience.
  const inputId = useLocalStorage('open-pencil:voice:input', SYSTEM_DEVICE)
  const outputId = useLocalStorage('open-pencil:voice:output', SYSTEM_DEVICE)
  const devices = useDevicesList({ constraints: { audio: true, video: false } })
  // A saved microphone that is unplugged falls back to the system's.
  const inputDevice = computed(() =>
    devices.audioInputs.value.some((device) => device.deviceId === inputId.value)
      ? inputId.value
      : SYSTEM_DEVICE
  )
  /** What calls play through; an empty sink is the system's. */
  const sinkId = computed(() =>
    outputId.value !== SYSTEM_DEVICE &&
    devices.audioOutputs.value.some((device) => device.deviceId === outputId.value)
      ? outputId.value
      : ''
  )
  const constraints = computed<MediaStreamConstraints>(() => ({
    audio: {
      deviceId: inputDevice.value === SYSTEM_DEVICE ? undefined : { exact: inputDevice.value },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  }))
  // Device changes restart the microphone here, where a failure can be reported.
  const microphone = useUserMedia({ constraints, autoSwitch: false })

  /** The room whose call this window is in; one at a time, since there is one microphone. */
  const room = shallowRef<RoomSession | null>(null)
  const joining = ref(false)
  const error = ref<VoiceCallError | null>(null)
  const muted = computed(() => room.value?.voice.muted.value ?? false)

  function sendMicrophone(stream: MediaStream | undefined) {
    const track = stream?.getAudioTracks()[0]
    if (track) track.enabled = !muted.value
    room.value?.voice.setMicrophone(stream && track ? { track, stream } : null)
  }

  function release() {
    room.value?.voice.setMicrophone(null)
    room.value = null
    microphone.stop()
  }

  function leave() {
    room.value?.voice.leave()
    release()
  }

  async function openMicrophone(): Promise<VoiceCallError | null> {
    if (!microphone.isSupported.value) return 'unsupported'
    if (!(await devices.ensurePermissions())) {
      return devices.audioInputs.value.length === 0 ? 'no-microphone' : 'denied'
    }
    try {
      return (await microphone.start()) ? null : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }

  async function join(session: RoomSession) {
    if (room.value === session || joining.value) return
    leave()
    error.value = null
    joining.value = true
    const failure = await openMicrophone()
    joining.value = false
    if (failure) {
      error.value = failure
      microphone.stop()
      return
    }
    room.value = session
    session.voice.join(false)
    sendMicrophone(microphone.stream.value)
  }

  function setMuted(next: boolean) {
    room.value?.voice.setMuted(next)
    for (const track of microphone.stream.value?.getAudioTracks() ?? []) track.enabled = !next
  }

  // A microphone reopened for another device replaces the one the call was sending.
  watch(microphone.stream, sendMicrophone)

  // Leaving the room, or closing its tab, ends the call.
  watch(
    () => room.value?.voice.joined.value,
    (joined) => {
      if (room.value && !joined) release()
    }
  )

  watch(inputDevice, async () => {
    if (!room.value) return
    try {
      await microphone.restart()
    } catch {
      error.value = 'unavailable'
      leave()
    }
  })

  return {
    room,
    joining,
    error,
    muted,
    inputId,
    outputId,
    sinkId,
    microphones: devices.audioInputs,
    speakers: devices.audioOutputs,
    join,
    leave,
    setMuted,
    toggleMuted: () => setMuted(!muted.value),
    dismissError: () => {
      error.value = null
    }
  }
}

export type VoiceCall = ReturnType<typeof createVoiceCall>

let call: VoiceCall | undefined

/** This window's voice call; it outlives the views that show it, as a call does. */
export function useVoiceCall(): VoiceCall {
  if (call) return call
  const created = effectScope(true).run(createVoiceCall)
  if (!created) throw new Error('Voice call scope did not run')
  call = created
  return call
}
