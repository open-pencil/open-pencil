import { describe, expect, test } from 'bun:test'

import {
  parseCSSTransform,
  parseCSSTransformOrigin,
  parseCSSTransforms
} from '@open-pencil/scene-graph/css'

const BOX = { width: 100, height: 50 }

function close(actual: number[] | null, expected: number[]) {
  expect(actual).not.toBeNull()
  actual?.forEach((value, index) => expect(value).toBeCloseTo(expected[index]))
}

describe('parseCSSTransform', () => {
  test('reads a computed matrix', () => {
    close(parseCSSTransform('matrix(0.5, 0.866, -0.866, 0.5, 10, 20)', BOX), [
      0.5, -0.866, 10, 0.866, 0.5, 20, 0, 0, 1
    ])
  })

  test('composes functions left to right, as CSS does', () => {
    // Translating then turning moves by the untransformed offset.
    close(parseCSSTransform('translateX(10px) rotate(90deg)', BOX), [0, -1, 10, 1, 0, 0, 0, 0, 1])
  })

  test('resolves translate percentages against the border box', () => {
    close(parseCSSTransform('translate(-50%, -50%)', BOX), [1, 0, -50, 0, 1, -25, 0, 0, 1])
  })

  test('reads angles in every unit', () => {
    for (const value of ['rotate(0.25turn)', 'rotate(100grad)', 'rotateZ(90deg)']) {
      close(parseCSSTransform(value, BOX), [0, -1, 0, 1, 0, 0, 0, 0, 1])
    }
  })

  test('is the identity for none, and null out of the plane or unreadable', () => {
    expect(parseCSSTransform('none', BOX)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    expect(parseCSSTransform('rotateX(30deg)', BOX)).toBeNull()
    expect(parseCSSTransform('translate(1em)', BOX)).toBeNull()
  })
})

describe('parseCSSTransforms', () => {
  test('applies translate, rotate, scale, then transform', () => {
    close(
      parseCSSTransforms(
        { translate: '5px 6px', rotate: '90deg', scale: '2', transform: 'translateX(1px)' },
        BOX
      ),
      [0, -2, 5, 2, 0, 8, 0, 0, 1]
    )
  })

  test('reads a turn about the z axis, and nothing about another', () => {
    close(parseCSSTransforms({ rotate: 'z 90deg' }, BOX), [0, -1, 0, 1, 0, 0, 0, 0, 1])
    expect(parseCSSTransforms({ rotate: 'x 90deg' }, BOX)).toBeNull()
  })
})

describe('parseCSSTransformOrigin', () => {
  test.each([
    [undefined, { x: 50, y: 25 }],
    ['50px 25px', { x: 50, y: 25 }],
    ['left top', { x: 0, y: 0 }],
    ['top left', { x: 0, y: 0 }],
    ['right', { x: 100, y: 25 }],
    ['bottom', { x: 50, y: 50 }],
    ['25% 100%', { x: 25, y: 50 }]
  ])('%s', (value, expected) => {
    expect(parseCSSTransformOrigin(value, BOX)).toEqual(expected)
  })
})
