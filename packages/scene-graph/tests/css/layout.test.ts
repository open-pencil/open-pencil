import { describe, expect, test } from 'bun:test'

import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
  parseCSSAspectRatio,
  parseCSSFlexDirection,
  parseCSSJustifyContent
} from '@open-pencil/scene-graph/css'

describe('CSS layout values', () => {
  test('flex directions that auto layout stacks along', () => {
    expect(parseCSSFlexDirection('row')).toBe('HORIZONTAL')
    expect(parseCSSFlexDirection(' COLUMN ')).toBe('VERTICAL')
    expect(parseCSSFlexDirection('row-reverse')).toBeUndefined()
    // Design JSX and .pen spellings are not CSS.
    expect(parseCSSFlexDirection('col')).toBeUndefined()
    expect(parseCSSJustifyContent('between')).toBeUndefined()
    expect(parseCSSJustifyContent('space-between')).toBe('SPACE_BETWEEN')
  })

  test('alignment drops the overflow position and reads first baseline as baseline', () => {
    expect(parseCSSJustifyContent('safe center')).toBe('CENTER')
    expect(parseCSSJustifyContent('unsafe flex-end')).toBe('MAX')
    expect(parseCSSAlignItems('first baseline')).toBe('BASELINE')
    expect(parseCSSAlignItems('last baseline')).toBeUndefined()
    expect(parseCSSJustifyContent('space-around')).toBeUndefined()
    expect(parseCSSAlignItems('var(--align)')).toBeUndefined()
  })

  test('normal aligns flex items as browsers do', () => {
    expect(parseCSSJustifyContent('normal')).toBe('MIN')
    expect(parseCSSAlignItems('normal')).toBe('STRETCH')
    expect(parseCSSAlignSelf('normal')).toBe('STRETCH')
    expect(parseCSSAlignSelf('auto')).toBe('AUTO')
  })
  test('aspect ratios as a number or a width and height, with or without auto', () => {
    expect(parseCSSAspectRatio('1.5')).toEqual({ ratio: 1.5, auto: false })
    expect(parseCSSAspectRatio('16 / 9')).toEqual({ ratio: 16 / 9, auto: false })
    expect(parseCSSAspectRatio('16/9')?.ratio).toBe(16 / 9)
    // A computed value keeps an `auto` beside the ratio, on either side.
    expect(parseCSSAspectRatio('auto 16 / 9')).toEqual({ ratio: 16 / 9, auto: true })
    expect(parseCSSAspectRatio('4 / 3 auto')).toEqual({ ratio: 4 / 3, auto: true })
    expect(parseCSSAspectRatio('auto')).toBeNull()
    expect(parseCSSAspectRatio('0 / 1')).toBeNull()
    expect(parseCSSAspectRatio('1 / 0')).toBeNull()
    expect(parseCSSAspectRatio('1e309 / 1e309')).toBeNull()
    expect(parseCSSAspectRatio('1e309')).toBeNull()
    expect(parseCSSAspectRatio('var(--ratio)')).toBeNull()
  })
})
