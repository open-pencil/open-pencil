import { randomIndex } from '@open-pencil/scene-graph/random'

/** Friendly words for a guest who has not set a name: "Teal Fox". */
const GUEST_COLORS = [
  'Amber',
  'Azure',
  'Coral',
  'Cobalt',
  'Copper',
  'Crimson',
  'Indigo',
  'Ivory',
  'Jade',
  'Lilac',
  'Olive',
  'Ruby',
  'Saffron',
  'Scarlet',
  'Teal',
  'Violet'
] as const

const GUEST_ANIMALS = [
  'Badger',
  'Crane',
  'Dolphin',
  'Falcon',
  'Fox',
  'Gecko',
  'Heron',
  'Ibis',
  'Koala',
  'Lynx',
  'Marten',
  'Otter',
  'Panda',
  'Puffin',
  'Raven',
  'Wombat'
] as const

/** A color and an animal, as a placeholder name until the person sets their own. */
export function generateGuestName(pick: (length: number) => number = randomIndex): string {
  const color = GUEST_COLORS[pick(GUEST_COLORS.length)] ?? GUEST_COLORS[0]
  const animal = GUEST_ANIMALS[pick(GUEST_ANIMALS.length)] ?? GUEST_ANIMALS[0]
  return `${color} ${animal}`
}
