import { describe, expect, test } from 'bun:test'

import { featureConditionCSS, parseFeatureCondition } from '#dom-css/tokens/conditions'

const narrow = {
  rule: 'media',
  feature: 'max-width',
  value: { type: 'dimension', value: 640, unit: 'px' }
} as const

describe('feature conditions', () => {
  test.each([
    '@media (max-width: 640px)',
    '@media(max-width:640px)',
    '  @media ( max-width :  640px )  ',
    '@media /* phones */ (max-width: 640px)',
    '@MEDIA (Max-Width: 640PX)'
  ])('%j tests one feature however it is spaced', (css) => {
    expect(parseFeatureCondition(css)).toEqual(narrow)
  })

  test('reads keywords and container queries', () => {
    expect(parseFeatureCondition('@media (prefers-color-scheme: dark)')).toEqual({
      rule: 'media',
      feature: 'prefers-color-scheme',
      value: { type: 'keyword', name: 'dark' }
    })
    expect(parseFeatureCondition('@container (min-width: 37.5px)')).toEqual({
      rule: 'container',
      feature: 'min-width',
      value: { type: 'dimension', value: 37.5, unit: 'px' }
    })
  })

  test.each([
    '@media\u00A0(max-width: 640px)',
    '@media (max-width: 640px) and (orientation: landscape)',
    '@media screen and (max-width: 640px)',
    '@container card (min-width: 400px)',
    '@supports (display: grid)',
    '@media (max-width: 640px) {} .a',
    '[data-theme="dark"]'
  ])('%j is not one at-rule testing one feature', (css) => {
    expect(parseFeatureCondition(css)).toBeUndefined()
  })

  test('a non-breaking space is not whitespace, so it joins the word after it, as in CSS', () => {
    expect(parseFeatureCondition('@media (max-width:\u00A0640px)')?.value).toEqual({
      type: 'keyword',
      name: '\u00A0640px'
    })
  })

  test('writes back as the stylesheet does', () => {
    expect(featureConditionCSS(narrow)).toBe('@media (max-width: 640px)')
  })
})
