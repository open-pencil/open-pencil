import { describe, expect, test } from 'bun:test'

import {
  paddingFromShorthand,
  parseAutoLayoutDirection,
  parseCounterAxisAlign,
  parseLayoutAlignSelf,
  parsePrimaryAxisAlign
} from '@open-pencil/scene-graph'

describe('auto layout keywords', () => {
  test('read stack directions in each format spelling', () => {
    for (const value of ['row', 'horizontal', 'ROW']) {
      expect(parseAutoLayoutDirection(value)).toBe('HORIZONTAL')
    }
    for (const value of ['column', 'col', 'vertical']) {
      expect(parseAutoLayoutDirection(value)).toBe('VERTICAL')
    }
    expect(parseAutoLayoutDirection('row-reverse')).toBeUndefined()
    expect(parseAutoLayoutDirection('constructor')).toBeUndefined()
  })

  test('read justify keywords from CSS and design JSX alike', () => {
    expect(parsePrimaryAxisAlign('space-between')).toBe('SPACE_BETWEEN')
    expect(parsePrimaryAxisAlign('between')).toBe('SPACE_BETWEEN')
    expect(parsePrimaryAxisAlign('flex-end')).toBe('MAX')
    expect(parsePrimaryAxisAlign(' Center ')).toBe('CENTER')
    // Auto layout cannot distribute space around or evenly.
    expect(parsePrimaryAxisAlign('space-around')).toBeUndefined()
    expect(parsePrimaryAxisAlign('space-evenly')).toBeUndefined()
  })

  test('read cross axis keywords, with auto only for one child', () => {
    expect(parseCounterAxisAlign('baseline')).toBe('BASELINE')
    expect(parseCounterAxisAlign('stretch')).toBe('STRETCH')
    expect(parseCounterAxisAlign('flex-start')).toBe('MIN')
    expect(parseCounterAxisAlign('auto')).toBeUndefined()
    expect(parseLayoutAlignSelf('auto')).toBe('AUTO')
    expect(parseLayoutAlignSelf('end')).toBe('MAX')
  })

  test('expand padding in CSS shorthand order', () => {
    expect(paddingFromShorthand([8])).toEqual({
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8
    })
    expect(paddingFromShorthand([8, 16])).toEqual({
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16
    })
    expect(paddingFromShorthand([1, 2, 3])).toEqual({
      paddingTop: 1,
      paddingRight: 2,
      paddingBottom: 3,
      paddingLeft: 2
    })
    expect(paddingFromShorthand([1, 2, 3, 4])).toEqual({
      paddingTop: 1,
      paddingRight: 2,
      paddingBottom: 3,
      paddingLeft: 4
    })
  })
})
