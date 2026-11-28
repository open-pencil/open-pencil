/** The deck's name in the gallery. */
export const DECK_NAME = 'Lumen 2 launch'

/** The deck's sections and their slides, in order; the last section is skipped while presenting. */
export const DECK_SECTIONS = [
  ['Cover', 'Agenda'],
  ['Covers', 'Controls', 'Modes', 'Numbers'],
  ['Close'],
  ['Components']
] as const

/** The Motion variables the cover's and the agenda's transitions follow. */
export const MOTION_VARIABLES = { slow: 'Motion/Slow', bouncy: 'Motion/Bouncy' } as const
