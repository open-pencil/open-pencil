import { describe, expect, test } from 'bun:test'

import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
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
})
