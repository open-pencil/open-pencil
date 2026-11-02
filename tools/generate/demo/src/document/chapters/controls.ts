import { Frame } from '@lawha/design-jsx'
import type { SceneGraph } from '@lawha/scene-graph'

import { previewPill } from '../chrome'
import type { PlayerParts } from '../player/card'
import { optionToggle, playToggle, progressSlider, skipButton } from '../player/controls'
import { layoutChapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'

/** The variant of the set `setId` named `name`. */
export function variantOf(graph: SceneGraph, setId: string, name: string): string {
  const variant = graph.getChildren(setId).find((child) => child.name === name)
  if (!variant) throw new Error(`The set has no variant "${name}"`)
  return variant.id
}

/**
 * Controls: the main components the player is built from, each with a behaviour. Returns the
 * variants the player's instances show.
 */
export async function createControlsChapter(context: ChapterContext): Promise<PlayerParts> {
  const { graph, theme } = context
  const { subject: board } = await layoutChapter(context, {
    chapter: CHAPTERS.controls,
    heading: {
      title: 'They work.',
      subtitle:
        'Each main component has a behaviour from the panel: a slider, two toggles, a button. In preview they run as real Reka UI controls, drawn by their own variants.'
    },
    subject: Frame({
      flex: 'col',
      w: 'hug',
      h: 'hug',
      gap: 32,
      p: 32,
      rounded: theme.vars.radius,
      bg: theme.vars.surface,
      stroke: theme.vars.line,
      children: [progressSlider(theme), playToggle(theme), optionToggle(theme), skipButton(theme)]
    }),
    tip: {
      step: 3,
      title: 'Press play',
      body: 'Open preview and press the play button: it swaps to pause. Drag the slider. Nothing you do in preview changes the document; Reset puts it all back.',
      keys: '⌥ ⌘ ↩',
      where: previewPill(theme)
    }
  })
  const [slider, play, option, skip] = graph.getChildren(board.id)
  return {
    slider: slider.id,
    play: variantOf(graph, play.id, 'Playing=Off'),
    shuffle: variantOf(graph, option.id, 'Pressed=On, Icon=Shuffle'),
    repeat: variantOf(graph, option.id, 'Pressed=Off, Icon=Repeat'),
    back: variantOf(graph, skip.id, 'Direction=Back, Interaction=Default'),
    forward: variantOf(graph, skip.id, 'Direction=Forward, Interaction=Default')
  }
}
