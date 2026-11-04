import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

describe('guides', () => {
  test('read and set a frame’s and a page’s own guides', () => {
    const figma = createAPI()
    const frame = figma.createFrame()
    expect(frame.guides).toEqual([])
    frame.guides = [
      { axis: 'X', offset: 10 },
      { axis: 'Y', offset: 2.5 }
    ]
    expect(frame.guides).toEqual([
      { axis: 'X', offset: 10 },
      { axis: 'Y', offset: 2.5 }
    ])
    expect(Object.isFrozen(frame.guides)).toBe(true)
    expect(
      figma.graph.getNode(frame.id)?.guides.map(({ axis, position }) => [axis, position])
    ).toEqual([
      ['x', 10],
      ['y', 2.5]
    ])
    const page = figma.currentPage
    page.guides = page.guides.concat({ axis: 'Y', offset: 40 })
    expect(page.guides).toEqual([{ axis: 'Y', offset: 40 }])
  })

  test('keep the identity of a guide set where one was, so a saved file updates it', () => {
    const figma = createAPI()
    const frame = figma.createFrame()
    frame.guides = [{ axis: 'X', offset: 10 }]
    const [before] = figma.graph.getNode(frame.id)?.guides ?? []
    frame.guides = [
      { axis: 'X', offset: 20 },
      { axis: 'Y', offset: 5 }
    ]
    const [moved, added] = figma.graph.getNode(frame.id)?.guides ?? []
    expect(moved?.id).toBe(before?.id)
    expect(added?.id).not.toBe(before?.id)
  })

  test('are checked as Figma checks them', () => {
    const frame = createAPI().createFrame()
    const message = (problem: string) =>
      `in set_guides: Property "guides" failed validation: ${problem}`
    expect(() => (frame.guides = [{ axis: 'Z', offset: 10 }] as never)).toThrow(
      message('Invalid option: expected one of "X"|"Y" at [0].axis')
    )
    expect(() => (frame.guides = [{ axis: 'X' }] as never)).toThrow(
      message('Required value missing at [0].offset')
    )
    expect(() => (frame.guides = [{ axis: 'X', offset: Infinity }])).toThrow(
      message('Expected number, received Infinity at [0].offset')
    )
    expect(() => (frame.guides = [{ axis: 'X', offset: 1, foo: 1 }] as never)).toThrow(
      message('Unrecognized key: "foo" at index 0')
    )
    expect(() => (frame.guides = [5] as never)).toThrow(
      message('Expected object, received number at index 0')
    )
    expect(frame.guides).toEqual([])
  })

  test('are a page’s and frame’s alone', () => {
    const figma = createAPI()
    expect('guides' in figma.createRectangle()).toBe(false)
    expect('guides' in figma.createText()).toBe(false)
  })
})

describe('horizontal and vertical padding', () => {
  test('read the first side and set both, as Figma’s deprecated members do', () => {
    const frame = createAPI().createFrame()
    expect([frame.horizontalPadding, frame.verticalPadding]).toEqual([0, 0])
    frame.paddingLeft = 4
    frame.paddingRight = 9
    expect(frame.horizontalPadding).toBe(4)
    frame.horizontalPadding = 7
    frame.verticalPadding = 3
    expect([frame.paddingLeft, frame.paddingRight, frame.paddingTop, frame.paddingBottom]).toEqual([
      7, 7, 3, 3
    ])
  })

  test('take numbers of zero or more', () => {
    const frame = createAPI().createFrame()
    const message = (problem: string) =>
      `in set_horizontalPadding: Property "horizontalPadding" failed validation: ${problem}`
    expect(() => (frame.horizontalPadding = -2)).toThrow(
      message('Too small: expected number to be >=0')
    )
    expect(() => (frame.horizontalPadding = 'x' as never)).toThrow(
      message('Expected number, received string')
    )
    expect(() => (frame.horizontalPadding = Infinity)).toThrow(
      message('Expected number, received Infinity')
    )
    expect(() => (frame.paddingLeft = Infinity)).toThrow(
      'in set_paddingLeft: Property "paddingLeft" failed validation: Expected number, received Infinity'
    )
    expect([frame.paddingLeft, frame.paddingRight]).toEqual([0, 0])
  })
})
