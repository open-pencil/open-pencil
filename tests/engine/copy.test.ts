import { describe, test, expect } from 'bun:test'
import {
  copyFill,
  copyFills,
  copyStroke,
  copyEffect,
  copyStyleRun,
  copyGeometryPaths
} from '../../packages/core/src/copy'
import type { Fill, Stroke, Effect, StyleRun, GeometryPath } from '@open-pencil/core'

describe('copy helpers — mutation isolation', () => {
  test('copyFill: mutating copy does not affect original', () => {
    const original: Fill = {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
    }
    const copy = copyFill(original)
    copy.color.r = 0
    copy.opacity = 0.5
    expect(original.color.r).toBe(1)
    expect(original.opacity).toBe(1)
  })

  test('copyFill: gradient stops are deep copied', () => {
    const original: Fill = {
      type: 'GRADIENT_LINEAR',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    }
    const copy = copyFill(original)
    copy.gradientStops![0].color.r = 0
    copy.gradientTransform!.m00 = 99
    expect(original.gradientStops![0].color.r).toBe(1)
    expect(original.gradientTransform!.m00).toBe(1)
  })

  test('copyStroke: dash pattern is independent', () => {
    const original: Stroke = {
      color: { r: 0, g: 0, b: 0, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'CENTER',
      dashPattern: [5, 3],
    }
    const copy = copyStroke(original)
    copy.dashPattern!.push(99)
    copy.color.g = 1
    expect(original.dashPattern).toEqual([5, 3])
    expect(original.color.g).toBe(0)
  })

  test('copyEffect: offset and color are independent', () => {
    const original: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 4, y: 4 },
      radius: 8,
      spread: 0,
      visible: true,
    }
    const copy = copyEffect(original)
    copy.offset.x = 100
    copy.color.a = 1
    expect(original.offset.x).toBe(4)
    expect(original.color.a).toBe(0.5)
  })

  test('copyStyleRun: style object is independent', () => {
    const original: StyleRun = {
      start: 0,
      length: 5,
      style: { fontWeight: 700, fontSize: 24 },
    }
    const copy = copyStyleRun(original)
    copy.style.fontWeight = 400
    expect(original.style.fontWeight).toBe(700)
  })

  test('copyGeometryPaths: Uint8Array is independent', () => {
    const original: GeometryPath[] = [
      { windingRule: 'NONZERO', commandsBlob: new Uint8Array([1, 2, 3]) },
    ]
    const copy = copyGeometryPaths(original)
    copy[0].commandsBlob[0] = 99
    expect(original[0].commandsBlob[0]).toBe(1)
  })

  test('copyFills: array independence', () => {
    const originals: Fill[] = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true },
      { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0.5, visible: true },
    ]
    const copies = copyFills(originals)
    copies.push({ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true })
    copies[0].color.r = 0
    expect(originals).toHaveLength(2)
    expect(originals[0].color.r).toBe(1)
  })
})
