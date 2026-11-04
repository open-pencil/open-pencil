import { describe, expect, test } from 'bun:test'

import { HAND_GRAB_CURSOR, toolCursor } from '#vue/editor/tool-cursor'

/** The hotspot and fallback that follow a CSS cursor's image. */
function cursorTail(cursor: string) {
  return cursor.slice(cursor.lastIndexOf(')') + 1).trim()
}

describe('toolCursor', () => {
  test('pen, comment, and hand draw their own cursors with a fallback', () => {
    expect(cursorTail(toolCursor('PEN'))).toBe('4 4, crosshair')
    expect(cursorTail(toolCursor('COMMENT'))).toBe('5 24, crosshair')
    expect(cursorTail(toolCursor('HAND'))).toBe('16 16, grab')
    expect(cursorTail(HAND_GRAB_CURSOR)).toBe('16 16, grabbing')
    for (const cursor of [toolCursor('PEN'), toolCursor('COMMENT'), toolCursor('HAND')]) {
      expect(cursor.startsWith('url("data:image/svg+xml,%3Csvg')).toBe(true)
    }
  })

  test('drawing tools keep the system crosshair and an override wins', () => {
    expect(toolCursor('RECTANGLE')).toBe('crosshair')
    expect(toolCursor('SELECT')).toBe('default')
    expect(toolCursor('HAND', 'move')).toBe('move')
  })
})
