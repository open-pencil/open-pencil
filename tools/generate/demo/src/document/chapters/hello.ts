import { Frame, Instance, shader } from '@open-pencil/design-jsx'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

import { previewButton } from '../chrome'
import { layoutChapter, type Chapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'
import type { Player } from './slots'

export const HERO_WIDTH = 880
export const HERO_HEIGHT = 640

/** The hero's background: a slow mesh of the theme's violets. */
export const HERO_PRESET: ShaderPreset = {
  components: [
    {
      type: 'MeshGradient',
      props: {
        stops: [
          { color: '#0F0F13', position: 0 },
          { color: '#2E1065', position: 0.3 },
          { color: '#7C3AED', position: 0.6 },
          { color: '#E879F9', position: 0.85 },
          { color: '#FDE68A', position: 1 }
        ],
        speed: 0.6,
        swirl: 0.4
      }
    }
  ]
}

/** Hello: the player on a live background, and the one thing to try first. */
export function createHelloChapter(context: ChapterContext, player: Player): Promise<Chapter> {
  return layoutChapter(context, {
    chapter: CHAPTERS.hello,
    heading: {
      title: 'Hello.',
      subtitle:
        'This file is a short tour. Scroll down, or drag the canvas with the hand tool, to follow it: every chapter shows one thing and a card tells you what to try. Nothing here is a mock-up: it is all editable.'
    },
    subject: Frame({
      flex: 'row',
      w: HERO_WIDTH,
      h: HERO_HEIGHT,
      justify: 'center',
      items: 'center',
      rounded: 32,
      overflow: 'hidden',
      bg: shader(HERO_PRESET),
      children: [Instance({ of: player.id })]
    }),
    tip: {
      step: 1,
      title: 'Press preview',
      body: 'The background starts to move and the player becomes a real control: press play, drag the progress, toggle shuffle. Esc brings you back.',
      keys: '⌥ ⌘ ↩',
      where: previewButton(context.theme)
    }
  })
}
