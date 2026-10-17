import { describe, expect, test } from 'bun:test'

import { applyTheme, buildVarContext, type PenVariable } from '@open-pencil/pen'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

/** A document declaring one colour per mode of a theme axis that is not called `theme`. */
function themedContext() {
  const variables: Record<string, PenVariable> = {
    '--brand': {
      type: 'color',
      value: [
        { value: '#111111', theme: { mode: 'light' } },
        { value: '#eeeeee', theme: { mode: 'dark' } }
      ]
    }
  }
  return buildVarContext(new SceneGraph(), variables, { mode: ['light', 'dark'] })
}

describe('switching a document theme', () => {
  test('reads the mode a node names under the axis it was declared in', () => {
    const ctx = themedContext()

    applyTheme({ mode: 'dark' }, ctx)

    expect(ctx.resolveColor('$--brand')).toEqual(parseColor('#eeeeee'))
  })

  test('answers with the mode it switched to, not the one it started on', () => {
    const ctx = themedContext()
    const dark = ctx.modeByThemeName.get('mode:dark')

    applyTheme({ mode: 'dark' }, ctx)

    expect(ctx.activeModeId).toBe(dark)
  })

  test('keeps the first mode until a node asks for another', () => {
    expect(themedContext().resolveColor('$--brand')).toEqual(parseColor('#111111'))
  })
})
