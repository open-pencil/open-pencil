import { describe, expect, test } from 'bun:test'

import { FontManager } from '@open-pencil/core'

import { isVariableFont, namedInstanceVariations } from '#core/text/font/variation'

interface Axis {
  tag: string
  min: number
  max: number
}

interface Instance {
  name: string
  coordinates: number[]
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function words(values: number[], bytes: 2 | 4): Uint8Array {
  const view = new DataView(new ArrayBuffer(values.length * bytes))
  values.forEach((value, index) =>
    bytes === 2 ? view.setUint16(index * 2, value) : view.setInt32(index * 4, value)
  )
  return new Uint8Array(view.buffer)
}

function ascii(tag: string): Uint8Array {
  return new TextEncoder().encode(tag)
}

function nameTable(names: string[]): Uint8Array {
  const strings = names.map((name) =>
    words(
      Array.from(name, (character) => character.charCodeAt(0)),
      2
    )
  )
  const header = words([0, names.length, 6 + names.length * 12], 2)
  let offset = 0
  const records = names.map((name, index) => {
    const record = words([3, 1, 0x409, 256 + index, strings[index].length, offset], 2)
    offset += strings[index].length
    return record
  })
  return concat([header, ...records, ...strings])
}

function fvarTable(axes: Axis[], instances: Instance[]): Uint8Array {
  const header = words([1, 0, 16, 2, axes.length, 20, instances.length, 4 + axes.length * 4], 2)
  const axisRecords = axes.map((axis) =>
    concat([
      ascii(axis.tag),
      words(
        [axis.min, axis.min, axis.max].map((value) => value * 65536),
        4
      ),
      words([0, 0], 2)
    ])
  )
  const instanceRecords = instances.map((instance, index) =>
    concat([
      words([256 + index, 0], 2),
      words(
        instance.coordinates.map((value) => value * 65536),
        4
      )
    ])
  )
  return concat([header, ...axisRecords, ...instanceRecords])
}

function variableFont(axes: Axis[], instances: Instance[]): ArrayBuffer {
  const tables: Array<[string, Uint8Array]> = [
    ['fvar', fvarTable(axes, instances)],
    ['name', nameTable(instances.map((instance) => instance.name))]
  ]
  const directory = concat([
    words([0x0001, 0x0000, tables.length, 0, 0, 0], 2),
    ...tables.map(([tag, data], index) => {
      const offset =
        12 + tables.length * 16 + tables.slice(0, index).reduce((size, [, t]) => size + t.length, 0)
      return concat([ascii(tag), words([0, offset, data.length], 4)])
    })
  ])
  return concat([directory, ...tables.map(([, data]) => data)]).buffer as ArrayBuffer
}

const SF_PRO_LIKE = variableFont(
  [
    { tag: 'wdth', min: 30, max: 150 },
    { tag: 'wght', min: 1, max: 1000 }
  ],
  [
    { name: 'Condensed Medium', coordinates: [60, 540] },
    { name: 'Regular', coordinates: [100, 400] },
    { name: 'Medium', coordinates: [100, 510] },
    { name: 'Semibold', coordinates: [100, 590] },
    { name: 'Bold Italic', coordinates: [100, 700] }
  ]
)

describe('namedInstanceVariations', () => {
  test('uses the coordinates of the named instance matching the style', () => {
    expect(namedInstanceVariations(SF_PRO_LIKE, 'Medium')).toEqual([
      { axis: 'wdth', value: 100 },
      { axis: 'wght', value: 510 }
    ])
    expect(namedInstanceVariations(SF_PRO_LIKE, 'Bold Italic')).toEqual([
      { axis: 'wdth', value: 100 },
      { axis: 'wght', value: 700 }
    ])
  })

  test('matches instance names regardless of case and spacing', () => {
    expect(namedInstanceVariations(SF_PRO_LIKE, 'SemiBold')).toEqual([
      { axis: 'wdth', value: 100 },
      { axis: 'wght', value: 590 }
    ])
  })

  test('clamps the style weight to the wght axis without a matching instance', () => {
    expect(namedInstanceVariations(SF_PRO_LIKE, 'Black')).toEqual([{ axis: 'wght', value: 900 }])
    const narrow = variableFont([{ tag: 'wght', min: 300, max: 600 }], [])
    expect(namedInstanceVariations(narrow, 'Bold')).toEqual([{ axis: 'wght', value: 600 }])
  })

  test('returns null for static fonts', () => {
    const header = words([0x0001, 0x0000, 0, 0, 0, 0], 2)
    expect(namedInstanceVariations(header.buffer as ArrayBuffer, 'Medium')).toBeNull()
    expect(isVariableFont(header.buffer as ArrayBuffer)).toBe(false)
    expect(isVariableFont(SF_PRO_LIKE)).toBe(true)
  })
})

describe('FontManager.namedInstanceVariations', () => {
  test('resolves variations from the face loaded for a style', () => {
    const manager = new FontManager()
    manager.markLoaded('SF Pro', 'Medium', SF_PRO_LIKE)
    expect(manager.namedInstanceVariations('SF Pro', 'Medium')).toEqual([
      { axis: 'wdth', value: 100 },
      { axis: 'wght', value: 510 }
    ])
    expect(manager.namedInstanceVariations('SF Pro', 'Bold')).toBeNull()
  })
})
