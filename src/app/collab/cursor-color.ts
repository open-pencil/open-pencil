import type { Color } from '@inkly/core/types'

import { PEER_COLORS } from '@/constants'

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function colorFromAnonymousId(anonymousId: string | null | undefined): Color {
  if (!anonymousId) return PEER_COLORS[0]
  return structuredClone(PEER_COLORS[hashString(anonymousId) % PEER_COLORS.length])
}
