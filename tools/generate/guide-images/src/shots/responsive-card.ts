import { buildScene, layerBox, showPlain } from '../app.ts'
import { SCENE_RADIUS } from '../scenes.ts'
import { PAIR_ZOOM, picture, plainFrame, type Shot } from './shared.ts'

/** A warm gradient where the photo goes. */
const PHOTO = "[linearGradient([['#FDBA74', 0], ['#F472B6', 1]])]"
const NAME = 'Ceramic mug'
const DESCRIPTION = 'Hand-thrown in small batches, and keeps your coffee warm for longer.'

/** The finished card at `width`: a photo, a name, a description, and a button. */
const card = (
  width: number
) => `<Frame name="Card" w={${width}} h="hug" flex="col" gap={12} p={20} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>
  <Frame name="Photo" w="fill" h={160} rounded={10} fills={${PHOTO}} />
  <Text name="Name" w="fill" size={18} weight={700} color="#18181B">${NAME}</Text>
  <Text name="Description" w="fill" size={14} color="#52525B">${DESCRIPTION}</Text>
  <Frame name="Button" flex="row" px={16} py={10} rounded={10} bg="#2563EB">
    <Text name="Label" size={14} weight={600} color="#FFFFFF">Add to cart</Text>
  </Frame>
</Frame>`

/** The parts before they go in a card: loose on a plain board, as a reader draws them. */
const PARTS = `<Frame name="Board" w={560} h={300} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>
  <Frame name="Photo" x={40} y={30} w={280} h={160} bg="#D4D4D8" />
  <Text name="Name" x={40} y={206} size={14} color="#000000">${NAME}</Text>
  <Text name="Description" x={40} y={232} size={14} color="#000000">${DESCRIPTION}</Text>
  <Text name="Label" x={40} y={258} size={14} color="#000000">Add to cart</Text>
</Frame>`

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  narrow: { take: (page) => plainFrame(page, card(240), 'Card', PAIR_ZOOM) },
  wide: { take: (page) => plainFrame(page, card(420), 'Card', PAIR_ZOOM) },
  parts: {
    async take(page) {
      await buildScene(page, PARTS, 1.2)
      await showPlain(page)
      return picture(page, await layerBox(page, ['Board']), SCENE_RADIUS * 1.2)
    }
  }
}
