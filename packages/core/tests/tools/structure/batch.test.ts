import { describe, expect, test } from 'bun:test'

import { setup, tool } from '#core-tests/helpers/atomic-tool'

import { executeAtomicTool } from '@open-pencil/core'

const batchUpdate = tool('batch_update')

/** A batch that renames the rectangle and changes one prop of the layer named `id`. */
function batch(rectangleId: string, id: string, props: Record<string, unknown>): string {
  return JSON.stringify([
    { id: rectangleId, props: { name: 'Renamed', opacity: 0.5 } },
    { id, props }
  ])
}

describe('batch_update', () => {
  test('applies every operation as one undo step', () => {
    const { figma, editor, undo, rectangle } = setup()
    const other = figma.createRectangle()
    const operations = batch(rectangle.id, other.id, { visible: false, corner_radius: '4' })

    expect(executeAtomicTool(editor, figma, batchUpdate, { operations })).toEqual({
      updated: 2,
      results: [
        { id: rectangle.id, updated: ['name', 'opacity'] },
        { id: other.id, updated: ['visible', 'corner_radius'] }
      ]
    })
    expect([rectangle.name, rectangle.opacity, other.cornerRadius, other.visible]).toEqual([
      'Renamed',
      0.5,
      4,
      false
    ])

    undo.undo()
    expect([rectangle.name, rectangle.opacity, other.cornerRadius, other.visible]).toEqual([
      'Rectangle',
      1,
      0,
      true
    ])
    expect(undo.canUndo).toBe(false)
  })

  test.each([
    ['a missing layer', 'missing', {}, 'Node "missing" not found'],
    ['a value of the wrong type', 'self', { spacing: 'wide' }, 'at 1.props.spacing'],
    ['a value outside its options', 'self', { counter_align: 'middle' }, 'at 1.props.counter_align'],
    ['a prop it does not take', 'self', { fill: '#f00' }, 'at 1.props.fill']
  ])('changes nothing when one operation names %s', (_, target, props, message) => {
    const { figma, editor, undo, rectangle } = setup()
    const id = target === 'self' ? rectangle.id : target
    const operations = batch(rectangle.id, id, props)

    expect(() => executeAtomicTool(editor, figma, batchUpdate, { operations })).toThrow(message)
    expect([rectangle.name, rectangle.opacity]).toEqual(['Rectangle', 1])
    expect(undo.canUndo).toBe(false)
  })

  test('changes nothing when a headless call names a missing layer', () => {
    const { figma, rectangle } = setup()
    const operations = batch(rectangle.id, 'missing', {})

    expect(batchUpdate.execute(figma, { operations })).toEqual({
      error: 'Node "missing" not found'
    })
    expect([rectangle.name, rectangle.opacity]).toEqual(['Rectangle', 1])
  })
})
