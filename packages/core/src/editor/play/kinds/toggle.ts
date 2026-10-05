import type { PlayControl, PlayInteraction } from './types'

function flip({ session, target }: PlayControl): void {
  session.setBoolean(target, 'value', !session.getBoolean(target, 'value'))
}

/** Switch and checkbox: a press, Space, or Enter flips the value. */
export const toggle: PlayInteraction = {
  press(pointer) {
    flip(pointer)
    return false
  },
  key(key) {
    if (key.key !== ' ' && key.key !== 'Enter') return false
    flip(key)
    return true
  }
}
