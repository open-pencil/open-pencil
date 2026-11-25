import { describe, expect, test } from 'bun:test'

import { createDocumentGraph } from '#core/editor/document-settings'
import { FigmaAPI } from '#core/figma-api'

function deck(): FigmaAPI {
  const api = new FigmaAPI(createDocumentGraph('slides', 'light'))
  api.createSlide()
  api.createSlideRow()
  api.createSlide()
  return api
}

function shape(api: FigmaAPI): string[][] {
  return api.getSlideGrid().map((row) => row.map((slide) => slide.id))
}

// Values and refusals as live Figma Slides reports them.
describe('Slides in the Plugin API', () => {
  test('slides go to the last row unless placed', () => {
    const api = deck()
    expect(shape(api).map((row) => row.length)).toEqual([2, 1])
    const placed = api.createSlide(0, 1)
    expect(shape(api)[0][1]).toBe(placed.id)
  })

  test('setSlideGrid reorders rows and slides, and refuses to lose one', () => {
    const api = deck()
    const [[first, second], [third]] = api.getSlideGrid()
    api.setSlideGrid([[third], [second, first]])
    expect(shape(api)).toEqual([[third.id], [second.id, first.id]])
    expect(() => api.setSlideGrid([[third]])).toThrow('every slide of the deck exactly once')
    expect(() =>
      api.setSlideGrid([
        [third, third],
        [second, first]
      ])
    ).toThrow('exactly once')
  })

  test('a row left empty is removed', () => {
    const api = deck()
    const [[first, second], [third]] = api.getSlideGrid()
    api.setSlideGrid([[first, second, third]])
    expect(shape(api)).toEqual([[first.id, second.id, third.id]])
    expect(api.currentPage.children[0].children).toHaveLength(1)
  })

  test('an unset transition reads as Figma reports it', () => {
    const [[slide]] = deck().getSlideGrid()
    expect(slide.getSlideTransition()).toEqual({
      style: 'NONE',
      duration: 0,
      curve: 'EASE_OUT',
      timing: { type: 'ON_CLICK' }
    })
    expect(slide.isSkippedSlide).toBe(false)
  })

  test('a transition and skipping are set, and bad values are refused', () => {
    const [[slide]] = deck().getSlideGrid()
    const transition = {
      style: 'PUSH_FROM_LEFT',
      duration: 0.4,
      curve: 'BOUNCY',
      timing: { type: 'AFTER_DELAY', delay: 2 }
    } as const
    slide.setSlideTransition(transition)
    slide.isSkippedSlide = true
    expect(slide.getSlideTransition()).toEqual(transition)
    expect(slide.isSkippedSlide).toBe(true)
    expect(() => slide.setSlideTransition({ ...transition, duration: 11 })).toThrow(
      'in setSlideTransition: Property "slideTransition" failed validation: Too big: expected number to be <=10 at .duration'
    )
    expect(() => slide.setSlideTransition({ ...transition, duration: 0 })).toThrow(
      'Too small: expected number to be >=0.01 at .duration'
    )
  })
})
