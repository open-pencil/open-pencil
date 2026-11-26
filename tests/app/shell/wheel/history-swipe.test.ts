import { describe, expect, test } from 'bun:test'

import type { HorizontalScroller } from '@/app/shell/wheel/history-swipe'
import { startsHistorySwipe } from '@/app/shell/wheel/history-swipe'

const BACK = { deltaX: -40, deltaY: 2 }
const FORWARD = { deltaX: 40, deltaY: 2 }

function scroller(overrides: Partial<HorizontalScroller> = {}): HorizontalScroller {
  return {
    scrollLeft: 0,
    scrollWidth: 600,
    clientWidth: 200,
    overflowX: 'auto',
    direction: 'ltr',
    ...overrides
  }
}

const under =
  (...scrollers: HorizontalScroller[]) =>
  () =>
    scrollers

describe('startsHistorySwipe', () => {
  test('a sideways swipe over nothing scrollable navigates', () => {
    expect(startsHistorySwipe(BACK, under())).toBe(true)
    expect(startsHistorySwipe(FORWARD, under())).toBe(true)
  })

  test('a mostly vertical scroll never navigates', () => {
    expect(startsHistorySwipe({ deltaX: -10, deltaY: 30 }, under())).toBe(false)
  })

  test('a scroller with room in the swipe direction takes the swipe', () => {
    expect(startsHistorySwipe(BACK, under(scroller({ scrollLeft: 120 })))).toBe(false)
    expect(startsHistorySwipe(FORWARD, under(scroller({ scrollLeft: 0 })))).toBe(false)
  })

  test('a scroller at its edge in the swipe direction lets the swipe navigate', () => {
    expect(startsHistorySwipe(BACK, under(scroller({ scrollLeft: 0 })))).toBe(true)
    expect(startsHistorySwipe(FORWARD, under(scroller({ scrollLeft: 400 })))).toBe(true)
  })

  test('an ancestor with room takes the swipe when the inner scroller is at its edge', () => {
    expect(
      startsHistorySwipe(BACK, under(scroller({ scrollLeft: 0 }), scroller({ scrollLeft: 50 })))
    ).toBe(false)
  })

  test('overflow the person cannot scroll does not take the swipe', () => {
    expect(
      startsHistorySwipe(BACK, under(scroller({ scrollLeft: 120, overflowX: 'hidden' })))
    ).toBe(true)
  })

  test('a right-to-left scroller measures from its right edge', () => {
    const rtl = (scrollLeft: number) => scroller({ direction: 'rtl', scrollLeft })
    expect(startsHistorySwipe(FORWARD, under(rtl(0)))).toBe(true)
    expect(startsHistorySwipe(BACK, under(rtl(0)))).toBe(false)
    expect(startsHistorySwipe(BACK, under(rtl(-400)))).toBe(true)
  })

  test('reads no element when the wheel moves vertically', () => {
    let read = false
    startsHistorySwipe({ deltaX: 0, deltaY: 30 }, () => {
      read = true
      return []
    })
    expect(read).toBe(false)
  })
})
