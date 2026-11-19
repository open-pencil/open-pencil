/** @jsxImportSource @open-pencil/design-jsx */
/**
 * The player's controls, written with Reka UI's element names: each is a main component or a
 * component set with a behaviour, so preview runs it as the real control.
 */
import { Button, Component, Slider, Toggle, type TreeNode } from '@open-pencil/design-jsx'

import { Icon } from '../elements'
import type { Theme } from '../theme'

export const TRACK_LENGTH = 230
export const TRACK_POSITION = 84
export const SLIDER_WIDTH = 320

/** The progress bar: a slider over the track's seconds. */
export function progressSlider({ vars }: Theme): TreeNode {
  const range = Math.round((SLIDER_WIDTH * TRACK_POSITION) / TRACK_LENGTH)
  return (
    <Slider.Root
      name="Progress"
      w={SLIDER_WIDTH}
      h={16}
      min={0}
      max={TRACK_LENGTH}
      step={1}
      defaultValue={TRACK_POSITION}
    >
      <Slider.Track x={0} y={6} w={SLIDER_WIDTH} h={4} rounded={2} bg={vars.line} />
      <Slider.Range x={0} y={6} w={range} h={4} rounded={2} bg={vars.accent} />
      <Slider.Thumb x={range - 8} y={0} w={16} h={16} rounded={8} bg={vars.text} />
    </Slider.Root>
  )
}

/** Play and pause: a toggle whose variants swap the icon. */
export function playToggle({ vars }: Theme): TreeNode {
  const variant = (state: 'Off' | 'On', icon: `lucide:${string}`) => (
    <Component
      name={`Playing=${state}`}
      flex="row"
      w={56}
      h={56}
      rounded={28}
      justify="center"
      items="center"
      bg={vars.accent}
    >
      <Icon name={icon} size={26} color={vars.onAccent} />
    </Component>
  )
  return (
    <Toggle.Root name="Play" modelValue="Playing" flex="row" gap={16} p={16}>
      {variant('Off', 'lucide:play')}
      {variant('On', 'lucide:pause')}
    </Toggle.Root>
  )
}

export const OPTIONS = [
  ['Shuffle', 'lucide:shuffle'],
  ['Repeat', 'lucide:repeat']
] as const

/** Shuffle and repeat: one set, two dimensions, so an instance picks the icon and the state. */
export function optionToggle({ vars }: Theme): TreeNode {
  return (
    <Toggle.Root name="Option" modelValue="Pressed" flex="row" gap={16} p={16}>
      {OPTIONS.flatMap(([option, icon]) =>
        (['Off', 'On'] as const).map((state) => (
          <Component
            name={`Pressed=${state}, Icon=${option}`}
            flex="row"
            w={40}
            h={40}
            rounded={vars.cornerRadius}
            justify="center"
            items="center"
            bg={state === 'On' ? vars.raised : undefined}
          >
            <Icon name={icon} size={20} color={state === 'On' ? vars.accent : vars.muted} />
          </Component>
        ))
      )}
    </Toggle.Root>
  )
}

export const DIRECTIONS = [
  ['Back', 'lucide:skip-back'],
  ['Forward', 'lucide:skip-forward']
] as const
const INTERACTIONS = ['Default', 'Hover', 'Pressed'] as const

/** Previous and next: a button set whose variants draw its interaction states. */
export function skipButton({ vars }: Theme): TreeNode {
  const background = { Default: undefined, Hover: vars.raised, Pressed: vars.line }
  return (
    <Button.Root name="Skip" states="Interaction" flex="row" gap={16} p={16}>
      {DIRECTIONS.flatMap(([direction, icon]) =>
        INTERACTIONS.map((interaction) => (
          <Component
            name={`Direction=${direction}, Interaction=${interaction}`}
            flex="row"
            w={44}
            h={44}
            rounded={22}
            justify="center"
            items="center"
            bg={background[interaction]}
          >
            <Icon name={icon} size={22} color={vars.muted} />
          </Component>
        ))
      )}
    </Button.Root>
  )
}
