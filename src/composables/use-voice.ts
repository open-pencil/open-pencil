import { ref, watch, onUnmounted, type InjectionKey, inject } from 'vue'

import { toast } from '@/composables/use-toast'
import {
  VOICE_SPEAKING_THRESHOLD,
  VOICE_SPEAKING_DEBOUNCE_MS,
  VOICE_DETECTION_INTERVAL_MS
} from '@/constants'

import type { CollabReturn } from '@/composables/use-collab'

export interface VoiceState {
  inCall: boolean
  muted: boolean
  speaking: boolean
}

export function useVoice(collab: CollabReturn) {
  const voiceState = ref<VoiceState>({
    inCall: false,
    muted: false,
    speaking: false
  })

  let localStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let detectionInterval: ReturnType<typeof setInterval> | null = null
  let speakingTimeout: ReturnType<typeof setTimeout> | null = null
  const peerAudioElements = new Map<string, HTMLAudioElement>()

  function broadcastVoiceState() {
    const awareness = collab.awarenessRef.value
    if (!awareness) return
    awareness.setLocalStateField('voice', { ...voiceState.value })
  }

  async function joinCall() {
    const room = collab.roomRef.value
    if (!room || voiceState.value.inCall) return

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.show(
          'Microphone access denied. Allow it in browser settings to use voice chat.',
          'error'
        )
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        toast.show('No microphone found. Connect a microphone to use voice chat.', 'error')
      } else {
        toast.show('Could not access microphone.', 'error')
      }
      return
    }

    voiceState.value = { inCall: true, muted: false, speaking: false }
    broadcastVoiceState()

    await Promise.allSettled(room.addStream(localStream))

    setupSpeakingDetection()
    setupPeerStreamListener()
  }

  function leaveCall() {
    if (!voiceState.value.inCall) return

    const room = collab.roomRef.value
    if (room && localStream) {
      room.removeStream(localStream)
    }

    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop()
      }
      localStream = null
    }

    teardownSpeakingDetection()
    cleanupAllPeerAudio()

    voiceState.value = { inCall: false, muted: false, speaking: false }
    broadcastVoiceState()
  }

  function toggleMute() {
    if (!voiceState.value.inCall || !localStream) return

    const muted = !voiceState.value.muted
    localStream.getAudioTracks()[0].enabled = !muted
    voiceState.value.muted = muted

    if (muted) {
      voiceState.value.speaking = false
    }

    broadcastVoiceState()
  }

  function setupSpeakingDetection() {
    if (!localStream) return

    audioContext = new AudioContext()
    // Resume is typically instant when triggered by user gesture, but await to be safe
    audioContext.resume().catch(() => {
      /* AudioContext resume may fail if not triggered by user gesture */
    })

    const source = audioContext.createMediaStreamSource(localStream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const timeDomainData = new Float32Array(analyser.fftSize)

    detectionInterval = setInterval(() => {
      if (!analyser || voiceState.value.muted) {
        if (voiceState.value.speaking) {
          voiceState.value.speaking = false
          broadcastVoiceState()
        }
        return
      }

      analyser.getFloatTimeDomainData(timeDomainData)

      let sumSquares = 0
      for (const sample of timeDomainData) {
        sumSquares += sample * sample
      }
      const rms = Math.sqrt(sumSquares / timeDomainData.length)

      if (rms > VOICE_SPEAKING_THRESHOLD) {
        if (speakingTimeout) {
          clearTimeout(speakingTimeout)
          speakingTimeout = null
        }
        if (!voiceState.value.speaking) {
          voiceState.value.speaking = true
          broadcastVoiceState()
        }
      } else if (voiceState.value.speaking && !speakingTimeout) {
        speakingTimeout = setTimeout(() => {
          voiceState.value.speaking = false
          broadcastVoiceState()
          speakingTimeout = null
        }, VOICE_SPEAKING_DEBOUNCE_MS)
      }
    }, VOICE_DETECTION_INTERVAL_MS)
  }

  function teardownSpeakingDetection() {
    if (detectionInterval) {
      clearInterval(detectionInterval)
      detectionInterval = null
    }
    if (speakingTimeout) {
      clearTimeout(speakingTimeout)
      speakingTimeout = null
    }
    if (audioContext) {
      void audioContext.close()
      audioContext = null
    }
    analyser = null
  }

  function setupPeerStreamListener() {
    const room = collab.roomRef.value
    if (!room) return

    room.onPeerStream((stream, peerId) => {
      if (!voiceState.value.inCall) return

      let audio = peerAudioElements.get(peerId)
      if (audio) {
        audio.srcObject = stream
      } else {
        audio = document.createElement('audio')
        audio.autoplay = true
        audio.srcObject = stream
        audio.play().catch(() => {
          /* autoplay policy — WebRTC streams are typically exempt */
        })
        peerAudioElements.set(peerId, audio)
      }
    })
  }

  collab.onPeerJoin((peerId) => {
    const room = collab.roomRef.value
    if (!room || !localStream || !voiceState.value.inCall) return
    void Promise.allSettled(room.addStream(localStream, peerId))
  })

  collab.onPeerLeave((peerId) => {
    cleanupPeerAudio(peerId)
  })

  function cleanupPeerAudio(peerId: string) {
    const audio = peerAudioElements.get(peerId)
    if (audio) {
      audio.pause()
      audio.srcObject = null
      peerAudioElements.delete(peerId)
    }
  }

  function cleanupAllPeerAudio() {
    for (const [peerId] of peerAudioElements) {
      cleanupPeerAudio(peerId)
    }
  }

  collab.registerVoiceCleanup(() => leaveCall())

  watch(
    () => collab.roomRef.value,
    (newRoom, oldRoom) => {
      if (oldRoom && !newRoom && voiceState.value.inCall) {
        leaveCall()
      }
    }
  )

  onUnmounted(() => {
    leaveCall()
  })

  return {
    voiceState,
    joinCall,
    leaveCall,
    toggleMute
  }
}

export type VoiceReturn = ReturnType<typeof useVoice>
export const VOICE_KEY = Symbol('voice') as InjectionKey<VoiceReturn>
export function useVoiceInjected() {
  return inject(VOICE_KEY)
}
