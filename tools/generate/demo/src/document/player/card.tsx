/** @jsxImportSource @open-pencil/design-jsx */
/**
 * The player card: the one object the tour keeps coming back to. A main component with text
 * properties for the track, a slot for the artwork, and the controls as nested instances.
 */
import {
  Component,
  Frame,
  Instance,
  Rectangle,
  Text,
  property,
  shader,
  type TreeNode
} from '@open-pencil/design-jsx'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

import type { Theme } from '../theme'

export const PLAYER_PROPERTIES = {
  title: property('Title', 'Night Drive'),
  artist: property('Artist', 'Lumen')
}

export const PLAYER_WIDTH = 360
export const ARTWORK_SIZE = 320
export const ARTWORK_NAME = 'Artwork'

/** The cover the component draws unless an instance puts something else in the slot. */
export const COVER_PRESET: ShaderPreset = {
  components: [
    {
      type: 'LinearGradient',
      props: {
        colorA: '#1B1035',
        colorB: '#0B0A14',
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 }
      }
    },
    {
      type: 'Aurora',
      props: { colorA: '#8B5CF6', colorB: '#22D3EE', colorC: '#F472B6', intensity: 90 }
    }
  ]
}

/** A cover that fills the artwork slot with a shader. */
export function shaderCover(preset: ShaderPreset, name = 'Cover'): TreeNode {
  return <Rectangle name={name} w="fill" h="fill" bg={shader(preset)} />
}

/** The main components a player is assembled from, by the variant each instance shows. */
export interface PlayerParts {
  slider: string
  play: string
  shuffle: string
  repeat: string
  back: string
  forward: string
}

export function playerComponent({ vars }: Theme, parts: PlayerParts): TreeNode {
  const time = (value: string) => (
    <Text font="Inter" size={12} color={vars.muted}>
      {value}
    </Text>
  )
  return (
    <Component
      name="Player"
      flex="col"
      w={PLAYER_WIDTH}
      h="hug"
      p={20}
      gap={20}
      rounded={vars.radius}
      bg={vars.surface}
      stroke={vars.line}
    >
      <Frame
        name={ARTWORK_NAME}
        flex="col"
        w={ARTWORK_SIZE}
        h={ARTWORK_SIZE}
        rounded={vars.cornerRadius}
        overflow="hidden"
      >
        {shaderCover(COVER_PRESET)}
      </Frame>
      <Frame name="Track" flex="col" w="fill" h="hug" gap={4}>
        <Text
          name="Title"
          font="Inter"
          size={20}
          weight={600}
          color={vars.text}
          text={PLAYER_PROPERTIES.title}
        />
        <Text
          name="Artist"
          font="Inter"
          size={14}
          color={vars.muted}
          text={PLAYER_PROPERTIES.artist}
        />
      </Frame>
      <Frame name="Progress" flex="col" w="fill" h="hug" gap={8}>
        <Instance of={parts.slider} />
        <Frame name="Times" flex="row" w="fill" h="hug" justify="between">
          {time('1:24')}
          {time('3:50')}
        </Frame>
      </Frame>
      <Frame name="Controls" flex="row" w="fill" h="hug" justify="between" items="center">
        <Instance of={parts.shuffle} />
        <Instance of={parts.back} />
        <Instance of={parts.play} />
        <Instance of={parts.forward} />
        <Instance of={parts.repeat} />
      </Frame>
    </Component>
  )
}
