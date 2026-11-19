import { expect, test } from 'bun:test'

import {
  screenCenterInWorld,
  screenToWorld,
  worldRectToScreen,
  worldToScreen
} from '#core/geometry/viewport'

const view = { zoom: 2, panX: 30, panY: -40 }

test('maps a page point to the canvas and back', () => {
  const screen = worldToScreen(view, { x: 10, y: 25 })
  expect(screen).toEqual({ x: 50, y: 10 })
  expect(screenToWorld(view, screen)).toEqual({ x: 10, y: 25 })
})

test('scales a page rectangle by the zoom', () => {
  expect(worldRectToScreen(view, { x: 10, y: 25, width: 5, height: 8 })).toEqual({
    x: 50,
    y: 10,
    width: 10,
    height: 16
  })
})

test('finds the page point at the middle of the canvas', () => {
  expect(screenCenterInWorld(view, 200, 100)).toEqual({ x: 35, y: 45 })
})
