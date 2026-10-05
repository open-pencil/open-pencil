import type { PlayInteraction } from './types'

/** Switch and checkbox: a press flips the value. */
export const toggle: PlayInteraction = {
  press({ session, target }) {
    session.setBoolean(target, 'value', !session.getBoolean(target, 'value'))
    return false
  }
}
