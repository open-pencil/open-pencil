import type { PlayKey } from './types'

/**
 * The item an arrow, Home, or End moves to among `count` items from `current`, wrapping around;
 * undefined for other keys.
 */
export function arrowIndex(
  key: PlayKey['key'],
  current: number,
  count: number
): number | undefined {
  const next: Partial<Record<PlayKey['key'], number>> = {
    ArrowRight: (current + 1) % count,
    ArrowDown: (current + 1) % count,
    ArrowLeft: (current - 1 + count) % count,
    ArrowUp: (current - 1 + count) % count,
    Home: 0,
    End: count - 1
  }
  return next[key]
}
