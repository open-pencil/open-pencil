import type { Color } from '@open-pencil/scene-graph/primitives'
import { useMessages } from '@open-pencil/vue/i18n'

import { PEER_COLORS } from '@/constants'

/**
 * How a comment's author is shown: their name, or "Someone" for comments other tools wrote
 * without one, on the color they had in the room, or the first collaborator color.
 */
export function useCommentAuthor() {
  const messages = useMessages('comments')
  return {
    name: (author: string) => author || messages.value.someone,
    color: (color: Color | undefined): Color => color ?? PEER_COLORS[0]
  }
}
