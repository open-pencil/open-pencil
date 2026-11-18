import { describe, expect, test } from 'bun:test'

import { applyCornerRadii, contentInsets, firstStrokeColor, hasBorder } from '#dom-css/import/box'

import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

describe('border sides', () => {
  test('a side that draws no border adds no inset, whatever its width', () => {
    const insets = contentInsets({
      padding: '10px',
      'border-top-style': 'none',
      'border-bottom-style': 'solid',
      'border-top-width': '5px',
      'border-bottom-width': '2px'
    })
    expect([insets.top, insets.bottom]).toEqual([10, 12])
  })

  test('the border-style shorthand gives each side its value, as CSS does', () => {
    const insets = contentInsets({ 'border-style': 'solid none', 'border-width': '4px' })
    expect(insets).toEqual({ top: 4, right: 0, bottom: 4, left: 0 })
    expect(contentInsets({ 'border-style': 'none none dashed', 'border-width': '4px' })).toEqual({
      top: 0,
      right: 0,
      bottom: 4,
      left: 0
    })
    expect(hasBorder({ 'border-style': 'none hidden' })).toBe(false)
    expect(hasBorder({ 'border-style': 'none none none solid' })).toBe(true)
  })
  test('box shorthands of several values give each side its own', () => {
    const insets = contentInsets({
      'border-style': 'solid',
      'border-width': '2px 6px',
      padding: '1px 3px 5px'
    })

    expect(insets).toEqual({ top: 3, right: 9, bottom: 7, left: 9 })
  })

  test('a side styled but without a width draws nothing, so the drawn side gives the color', () => {
    // A reset such as `* { border: 0 solid }`, then one side given a transparent border.
    const style = {
      'border-top-style': 'solid',
      'border-top-width': '0px',
      'border-top-color': 'rgb(60, 60, 67)',
      'border-bottom-style': 'solid',
      'border-bottom-width': '1px',
      'border-bottom-color': 'rgba(0, 0, 0, 0)'
    }

    expect(hasBorder(style)).toBe(true)
    expect(firstStrokeColor(style)).toBe('rgba(0, 0, 0, 0)')
    expect(hasBorder({ 'border-style': 'solid', 'border-width': '0px' })).toBe(false)
  })

  test('a percentage corner radius is of the box, so 50% rounds a square into a circle', () => {
    const dot = createDefaultNode(() => 'layer', 'FRAME')
    applyCornerRadii(
      dot,
      {
        'border-top-left-radius': '50%',
        'border-top-right-radius': '50%',
        'border-bottom-right-radius': '50%',
        'border-bottom-left-radius': '50%'
      },
      { width: 9, height: 9 }
    )
    const pill = createDefaultNode(() => 'layer', 'FRAME')
    applyCornerRadii(pill, { 'border-radius': '50%' }, { width: 80, height: 20 })

    expect(dot.cornerRadius).toBe(4.5)
    expect(pill.cornerRadius).toBe(10)
  })
})
