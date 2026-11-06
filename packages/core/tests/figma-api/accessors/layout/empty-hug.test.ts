import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'// Figma's answers measured in Figma desktop 126 on 2026-11-03: a hugging frame with nothing in
// its flow keeps the size it has, whatever else changes, until it has a layer to hug again.

function hugging(figma: ReturnType<typeof createAPI>, layoutMode: 'HORIZONTAL' | 'VERTICAL') {
  const frame = figma.createFrame()
  frame.resize(200, 120)
  frame.layoutMode = layoutMode
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'AUTO'
  return frame
}

const size = (frame: { width: number; height: number }) => [frame.width, frame.height]

describe('empty hugging frames', () => {
  test('a new frame keeps the size it was made at through every layout change', () => {
    const figma = createAPI()
    const frame = hugging(figma, 'VERTICAL')
    expect(size(frame)).toEqual([200, 120])
    const changes = [
      () => (frame.itemSpacing = 10),
      () => (frame.counterAxisAlignItems = 'CENTER'),
      () => (frame.layoutMode = 'HORIZONTAL'),
      () => (frame.paddingLeft = 8),
      () => (frame.paddingTop = 4)
    ]
    for (const change of changes) {
      change()
      expect(size(frame)).toEqual([200, 120])
    }
  })

  test('an empty frame inside an auto layout frame keeps its size there too', () => {
    const figma = createAPI()
    const row = hugging(figma, 'HORIZONTAL')
    const empty = hugging(figma, 'VERTICAL')
    row.appendChild(empty)
    expect(size(empty)).toEqual([200, 120])
    expect(size(row)).toEqual([200, 120])
    row.paddingLeft = 10
    expect(size(empty)).toEqual([200, 120])
    expect(size(row)).toEqual([210, 120])
  })

  test('a frame that loses its last layer keeps the size it hugged to, then hugs the next', () => {
    const figma = createAPI()
    const frame = hugging(figma, 'VERTICAL')
    const first = figma.createRectangle()
    first.resize(50, 30)
    frame.appendChild(first)
    expect(size(frame)).toEqual([50, 30])
    first.remove()
    frame.itemSpacing = 6
    frame.paddingRight = 3
    expect(size(frame)).toEqual([50, 30])
    const next = figma.createRectangle()
    next.resize(20, 10)
    frame.appendChild(next)
    expect(size(frame)).toEqual([23, 10])
  })

  test('a frame whose only layer is hidden or placed absolutely keeps its size', () => {
    const figma = createAPI()
    for (const change of ['hide', 'absolute'] as const) {
      const frame = hugging(figma, 'HORIZONTAL')
      const rect = figma.createRectangle()
      rect.resize(40, 40)
      frame.appendChild(rect)
      expect(size(frame)).toEqual([40, 40])
      if (change === 'hide') rect.visible = false
      else rect.layoutPositioning = 'ABSOLUTE'
      frame.paddingLeft = 5
      expect(size(frame)).toEqual([40, 40])
    }
  })

  test('resizing a hugging frame fixes both its axes', () => {
    const figma = createAPI()
    const frame = hugging(figma, 'HORIZONTAL')
    frame.resize(300, 200)
    expect([frame.primaryAxisSizingMode, frame.counterAxisSizingMode]).toEqual(['FIXED', 'FIXED'])
    expect(size(frame)).toEqual([300, 200])
  })
})
