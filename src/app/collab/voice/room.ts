import { useIntervalFn } from '@vueuse/core'
import * as v from 'valibot'
import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { Awareness } from 'y-protocols/awareness'

import type { CollabRoomConnection } from '@/app/collab/room/connection'
import type { RemotePeer } from '@/app/collab/types'

/** How often levels are read while in a call. */
const LEVEL_INTERVAL_MS = 100
/** WebRTC audio levels run 0–1 on a linear scale; speech sits well above this, room noise below. */
const SPEAKING_LEVEL = 0.02
/** How long someone still counts as speaking after their level drops, so pauses between words don't flicker. */
const SPEAKING_HOLD_MS = 400

const MediaSourceStats = v.object({ type: v.literal('media-source'), audioLevel: v.number() })

/** The microphone a call sends, as `getUserMedia` returned it. */
export interface Microphone {
  track: MediaStreamTrack
  stream: MediaStream
}

/** A room's voice call, as this tab takes part in it. */
export interface RoomVoice {
  readonly joined: Readonly<Ref<boolean>>
  readonly muted: Readonly<Ref<boolean>>
  /** Everyone else in the call, by presence client. */
  readonly members: ComputedRef<readonly RemotePeer[]>
  /** What to play while we are in the call, by presence client. */
  readonly audio: ComputedRef<ReadonlyMap<number, MediaStreamTrack>>
  /** Presence clients speaking now, ours included. */
  readonly speaking: Readonly<Ref<ReadonlySet<number>>>
  readonly localClientId: number
  join(muted: boolean): void
  setMuted(muted: boolean): void
  /** What this tab sends; null while no microphone is open. */
  setMicrophone(microphone: Microphone | null): void
  leave(): void
  dispose(): void
}

export interface RoomVoiceOptions {
  awareness: Awareness
  peers: Readonly<Ref<readonly RemotePeer[]>>
  connection: Pick<CollabRoomConnection, 'room' | 'onPeerLeave' | 'peerForClient'>
}

/**
 * Who is in a room's call travels in presence; audio goes only to the people in it, and only
 * while we are in it too. Speaking comes from the levels WebRTC reports for each connection.
 */
export function attachRoomVoice({ awareness, peers, connection }: RoomVoiceOptions): RoomVoice {
  const media = connection.room.media
  const joined = ref(false)
  const muted = ref(false)
  const speaking = shallowRef<ReadonlySet<number>>(new Set())
  const received = shallowRef<ReadonlyMap<string, MediaStreamTrack>>(new Map())
  let microphone: Microphone | null = null
  /** The peers our microphone is going to, and which track they get. */
  const sending = new Map<string, MediaStreamTrack>()
  const lastHeard = new Map<number, number>()

  const members = computed(() => peers.value.filter((peer) => peer.voice))

  const audio = computed(() => {
    const tracks = new Map<number, MediaStreamTrack>()
    if (!joined.value) return tracks
    for (const peer of members.value) {
      const peerId = connection.peerForClient(peer.clientId)
      const track = peerId ? received.value.get(peerId) : undefined
      if (track) tracks.set(peer.clientId, track)
    }
    return tracks
  })

  function setReceived(peerId: string, track: MediaStreamTrack | null) {
    const next = new Map(received.value)
    if (track) next.set(peerId, track)
    else next.delete(peerId)
    received.value = next
  }

  function stopSending(peerId: string) {
    const track = sending.get(peerId)
    if (track) media?.removeTrack(track, peerId)
    sending.delete(peerId)
  }

  /** Sends our microphone to exactly the people in the call. */
  function reconcile() {
    if (!media) return
    const targets = new Set<string>()
    if (joined.value && microphone) {
      for (const peer of members.value) {
        const peerId = connection.peerForClient(peer.clientId)
        if (peerId) targets.add(peerId)
      }
    }
    for (const peerId of sending.keys()) {
      if (!targets.has(peerId)) stopSending(peerId)
    }
    if (!microphone) return
    for (const peerId of targets) {
      const current = sending.get(peerId)
      if (current === microphone.track) continue
      if (current) media.replaceTrack(current, microphone.track, peerId)
      else media.addTrack(microphone.track, microphone.stream, peerId)
      sending.set(peerId, microphone.track)
    }
  }

  media?.onPeerTrack((track, peerId) => {
    if (track.kind !== 'audio') return
    setReceived(peerId, track)
    track.addEventListener(
      'ended',
      () => {
        if (received.value.get(peerId) === track) setReceived(peerId, null)
      },
      { once: true }
    )
  })

  const stopLeave = connection.onPeerLeave((peerId) => {
    sending.delete(peerId)
    setReceived(peerId, null)
  })
  const stopMembers = watch(members, reconcile)

  function heard(clientId: number, level: number | undefined, now: number) {
    if (level !== undefined && level >= SPEAKING_LEVEL) lastHeard.set(clientId, now)
  }

  async function localLevel(): Promise<number | undefined> {
    const track = microphone?.track
    if (!media || !track || muted.value) return undefined
    for (const peerId of sending.keys()) {
      const sender = media
        .connection(peerId)
        ?.getSenders()
        .find((candidate) => candidate.track === track)
      if (!sender) continue
      const stats = await sender.getStats()
      for (const report of stats.values()) {
        const source = v.safeParse(MediaSourceStats, report)
        if (source.success) return source.output.audioLevel
      }
    }
    return undefined
  }

  async function readLevels() {
    const now = Date.now()
    for (const [clientId, track] of audio.value) {
      const peerId = connection.peerForClient(clientId)
      const receiver = peerId
        ? media
            ?.connection(peerId)
            ?.getReceivers()
            .find((candidate) => candidate.track === track)
        : undefined
      heard(clientId, receiver?.getSynchronizationSources()[0]?.audioLevel, now)
    }
    heard(awareness.clientID, await localLevel(), now)
    const next = new Set<number>()
    for (const [clientId, at] of lastHeard) {
      if (now - at < SPEAKING_HOLD_MS) next.add(clientId)
      else lastHeard.delete(clientId)
    }
    const current = speaking.value
    if (next.size !== current.size || [...next].some((clientId) => !current.has(clientId))) {
      speaking.value = next
    }
  }

  const levels = useIntervalFn(() => void readLevels(), LEVEL_INTERVAL_MS, { immediate: false })

  function publish() {
    awareness.setLocalStateField('voice', joined.value ? { muted: muted.value } : null)
  }

  function leave() {
    if (!joined.value) return
    joined.value = false
    levels.pause()
    lastHeard.clear()
    speaking.value = new Set()
    publish()
    reconcile()
  }

  return {
    joined,
    muted,
    members,
    audio,
    speaking,
    localClientId: awareness.clientID,
    join(startMuted) {
      muted.value = startMuted
      joined.value = true
      publish()
      reconcile()
      if (media) levels.resume()
    },
    setMuted(next) {
      muted.value = next
      if (joined.value) publish()
    },
    setMicrophone(next) {
      microphone = next
      reconcile()
    },
    leave,
    dispose() {
      leave()
      levels.pause()
      stopMembers()
      stopLeave()
      microphone = null
      sending.clear()
      received.value = new Map()
    }
  }
}
