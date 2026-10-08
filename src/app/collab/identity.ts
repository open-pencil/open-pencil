import { createGlobalState, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomIndex } from '@open-pencil/scene-graph/random'

import { generateGuestName } from '@/app/collab/guest-name'
import { PEER_COLORS } from '@/constants'

export const COLLAB_NAME_STORAGE_KEY = 'op-collab-name'

/**
 * Who this person is in every room: one name for the whole app, kept across sessions, and one
 * color for this session. Until they set a name they join as a generated one, such as
 * "Teal Fox", so a room opens without asking first.
 */
export const useCollabIdentity = createGlobalState(() => {
  const storedName = useLocalStorage(COLLAB_NAME_STORAGE_KEY, '')
  const guestName = generateGuestName()
  const color: Color = PEER_COLORS[randomIndex(PEER_COLORS.length)] ?? PEER_COLORS[0]
  const name = computed(() => storedName.value.trim() || guestName)
  const hasChosenName = computed(() => storedName.value.trim().length > 0)

  function setName(next: string) {
    storedName.value = next.trim()
  }

  return { name, color, hasChosenName, setName }
})
