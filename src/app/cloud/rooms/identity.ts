import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { presenceName } from '@open-pencil/cloud/contract'

import type { RoomIdentity } from '@/app/collab/session'
import { PEER_COLORS } from '@/constants'

import type { CloudAccount } from '../servers/store'

/** The same index for the same id on every device, so a person keeps one color. */
function colorIndex(id: string): number {
  let hash = 0
  for (const character of id) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  return hash % PEER_COLORS.length
}

/**
 * Who a signed-in member is in their documents' rooms: their account's name, as the relay shows
 * them to everyone else and following a rename, on one color for every tab they have open.
 */
export function accountRoomIdentity(
  account: MaybeRefOrGetter<Pick<CloudAccount, 'id' | 'name'>>
): RoomIdentity {
  return {
    // Cut as the relay cuts it for everyone else, so this tab shows what they see.
    name: computed(() => presenceName(toValue(account).name)),
    color: PEER_COLORS[colorIndex(toValue(account).id)] ?? PEER_COLORS[0]
  }
}
