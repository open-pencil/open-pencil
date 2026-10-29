import { Frame, Instance, Text, linearGradient, type TreeNode } from '@open-pencil/design-jsx'
import { createComponentPropertyId } from '@open-pencil/scene-graph/components'
import { createSlotProperty, updateSlotProperty } from '@open-pencil/scene-graph/slots'

import { slotRow } from '../chrome'
import { Icon } from '../elements'
import { renderTree } from '../icons'
import { ARTWORK_NAME, PLAYER_PROPERTIES, playerComponent, type PlayerParts } from '../player/card'
import { fillSlot } from '../slot-content'
import type { Theme } from '../theme'
import { layoutChapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'

export interface Player {
  /** The Player main component. */
  id: string
  /** Its artwork slot property. */
  slotId: string
}

/** A cover made of a gradient and an icon. */
function iconCover({ vars }: Theme): TreeNode {
  return Frame({
    name: 'Cover',
    flex: 'row',
    w: 'fill',
    h: 'fill',
    justify: 'center',
    items: 'center',
    fills: [
      linearGradient(
        [
          ['#F97316', 0],
          ['#EC4899', 1]
        ],
        { transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 } }
      )
    ],
    children: [Icon({ name: 'lucide:disc-3', size: 160, color: vars.onAccent })]
  })
}

/** A cover made of type. */
function typeCover({ vars }: Theme): TreeNode {
  return Frame({
    name: 'Cover',
    flex: 'col',
    w: 'fill',
    h: 'fill',
    p: 24,
    justify: 'end',
    bg: vars.accent,
    children: [
      Text({
        font: 'Inter',
        size: 96,
        weight: 800,
        lineHeight: 84,
        letterSpacing: -4,
        color: vars.onAccent,
        children: 'LO\nFI'
      })
    ]
  })
}

/**
 * Slots: the Player main component, whose artwork is a slot, and instances that fill the slot
 * with their own layers.
 */
export async function createSlotsChapter(
  context: ChapterContext,
  parts: PlayerParts
): Promise<Player> {
  const { graph, theme } = context
  const player: Player = { id: '', slotId: createComponentPropertyId() }
  await layoutChapter(context, {
    chapter: CHAPTERS.slots,
    heading: {
      title: 'It is a component.',
      subtitle:
        'The player on the left is the main component. Its artwork is a slot: every instance keeps the player and brings its own cover.'
    },
    subject: Frame({
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 40,
      items: 'start',
      children: [playerComponent(theme, parts)]
    }),
    tip: {
      step: 2,
      title: 'Change a cover',
      body: 'Select the middle player: its Artwork slot reads Modified. Drop any layer into the slot, or use the slot’s menu to reset it to the component’s cover.',
      where: slotRow(theme)
    },
    async fill(row) {
      const [component] = graph.getChildren(row.id)
      player.id = component.id
      const artwork = graph.getChildren(component.id).find((child) => child.name === ARTWORK_NAME)
      if (!artwork || !createSlotProperty(graph, artwork.id, player.slotId)) {
        throw new Error('The player has no artwork frame to make a slot of')
      }
      updateSlotProperty(graph, component.id, player.slotId, {
        description: 'The cover. Any layer goes here; the player keeps everything else.',
        slotSettings: { minChildren: 1, maxChildren: 1, stretchChildOnInsert: true }
      })
      const covers: { title: string; artist: string; cover: TreeNode }[] = [
        { title: 'Side B', artist: 'The Tapes', cover: iconCover(theme) },
        { title: 'Lo-fi Hours', artist: 'Various', cover: typeCover(theme) }
      ]
      for (const { title, artist, cover } of covers) {
        const instance = await renderTree(
          graph,
          Instance({
            of: component.id,
            properties: {
              [PLAYER_PROPERTIES.title.name]: title,
              [PLAYER_PROPERTIES.artist.name]: artist
            }
          }),
          { parentId: row.id }
        )
        await fillSlot(graph, instance.id, player.slotId, cover)
      }
    }
  })
  return player
}
