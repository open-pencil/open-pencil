import { describe, expect, test } from 'bun:test'

import {
  changeConditionKind,
  isAutomaticCondition,
  modeConditionCSS,
  parseModeCondition,
  type ModeCondition
} from '@/app/editor/tokens/conditions'

describe('mode condition presets', () => {
  test.each<[ModeCondition, string | undefined]>([
    [{ kind: 'manual' }, undefined],
    [{ kind: 'dark' }, '@media (prefers-color-scheme: dark)'],
    [{ kind: 'light' }, '@media (prefers-color-scheme: light)'],
    [{ kind: 'contrast' }, '@media (prefers-contrast: more)'],
    [{ kind: 'reduced-motion' }, '@media (prefers-reduced-motion: reduce)'],
    [{ kind: 'screen-narrower', width: 640 }, '@media (max-width: 640px)'],
    [{ kind: 'screen-wider', width: 1024 }, '@media (min-width: 1024px)'],
    [{ kind: 'container-narrower', width: 480 }, '@container (max-width: 480px)'],
    [{ kind: 'container-wider', width: 37.5 }, '@container (min-width: 37.5px)'],
    [{ kind: 'custom', css: '.dark' }, '.dark']
  ])('%o writes %s and reads back', (condition, css) => {
    expect(modeConditionCSS(condition)).toBe(css)
    expect(parseModeCondition(css)).toEqual(condition)
  })

  test('reads hand-written conditions with other spacing as their preset', () => {
    expect(parseModeCondition('@media(prefers-color-scheme:dark)')).toEqual({ kind: 'dark' })
    expect(parseModeCondition('  @media ( max-width :  640px )  ')).toEqual({
      kind: 'screen-narrower',
      width: 640
    })
  })

  test('keeps anything else as custom CSS', () => {
    expect(parseModeCondition('@media (max-width: 40rem)')).toEqual({
      kind: 'custom',
      css: '@media (max-width: 40rem)'
    })
    expect(parseModeCondition('[data-theme="dark"]')).toEqual({
      kind: 'custom',
      css: '[data-theme="dark"]'
    })
    // A non-breaking space is not CSS whitespace, so this is not the dark preset.
    expect(parseModeCondition('@media\u00A0(prefers-color-scheme: dark)').kind).toBe('custom')
  })

  test('an empty custom condition falls back to the manual attribute', () => {
    expect(modeConditionCSS({ kind: 'custom', css: '  ' })).toBeUndefined()
  })

  test('switching presets carries the width and the written CSS', () => {
    const narrow: ModeCondition = { kind: 'screen-narrower', width: 720 }
    expect(changeConditionKind(narrow, 'container-wider')).toEqual({
      kind: 'container-wider',
      width: 720
    })
    expect(changeConditionKind({ kind: 'dark' }, 'screen-wider')).toEqual({
      kind: 'screen-wider',
      width: 640
    })
    expect(changeConditionKind(narrow, 'custom')).toEqual({
      kind: 'custom',
      css: '@media (max-width: 720px)'
    })
  })

  test('only the attribute and custom selectors are switched by the page', () => {
    expect(isAutomaticCondition({ kind: 'manual' })).toBe(false)
    expect(isAutomaticCondition({ kind: 'custom', css: '.dark' })).toBe(false)
    expect(isAutomaticCondition({ kind: 'custom', css: '@supports (color: oklch(0 0 0))' })).toBe(
      true
    )
    expect(isAutomaticCondition({ kind: 'dark' })).toBe(true)
  })
})
