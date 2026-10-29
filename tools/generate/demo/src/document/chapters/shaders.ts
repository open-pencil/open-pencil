import { Frame, Rectangle, Text, shader, type TreeNode } from '@open-pencil/design-jsx'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

import { fillRow } from '../chrome'
import { COVER_PRESET } from '../player/card'
import type { Theme } from '../theme'
import { layoutChapter, type Chapter, type ChapterContext } from './chapter'
import { CHAPTERS } from './names'

const TILE = 320

/** Three presets from the `shaders` library, each a fill on an ordinary rectangle. */
const PRESETS: { name: string; preset: ShaderPreset }[] = [
  { name: 'Aurora', preset: COVER_PRESET },
  {
    name: 'Flowing gradient',
    preset: {
      components: [
        {
          type: 'FlowingGradient',
          props: { colorA: '#0F0F13', colorB: '#6D28D9', colorC: '#F472B6', colorD: '#FDE68A' }
        }
      ]
    }
  },
  {
    name: 'Plasma',
    preset: {
      components: [
        { type: 'Plasma', props: { colorA: '#8B5CF6', colorB: '#0F0F13', density: 1.5 } }
      ]
    }
  }
]

function tile({ vars }: Theme, { name, preset }: (typeof PRESETS)[number]): TreeNode {
  return Frame({
    name,
    flex: 'col',
    w: 'hug',
    h: 'hug',
    gap: 14,
    children: [
      Rectangle({ name: 'Shader', w: TILE, h: TILE, rounded: vars.radius, bg: shader(preset) }),
      Text({ font: 'Inter', size: 14, weight: 500, color: vars.muted, children: name })
    ]
  })
}

/** Shaders: a fill that moves, on plain rectangles, with its preset editable in the fill picker. */
export function createShadersChapter(context: ChapterContext): Promise<Chapter> {
  return layoutChapter(context, {
    chapter: CHAPTERS.shaders,
    heading: {
      title: 'Fills can move.',
      subtitle:
        'A shader is a fill like any other: pick it in the fill picker, stack effects, tune their sliders, or paste a preset from shaders.com. Files keep a still of it, and preview plays it.'
    },
    subject: Frame({
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 32,
      children: PRESETS.map((entry) => tile(context.theme, entry))
    }),
    tip: {
      step: 5,
      title: 'Change a shader',
      body: 'Select a square and click its fill in the panel. The Shader tab lists the effects it is made of: drag a slider, add an effect on top, or replace the preset.',
      where: fillRow(context.theme, 'Aurora, Linear …')
    }
  })
}
