import type { FontVariation } from '@open-pencil/scene-graph'
import {
  styleSpelling,
  styleToWeight,
  type FontFamilyStyle
} from '@open-pencil/scene-graph/font-style'

interface TableRange {
  offset: number
  length: number
}

const WINDOWS_PLATFORM = 3
const MAC_PLATFORM = 1
const ENGLISH_US = 0x409
/** Windows names are UTF-16; Mac names are read in the Roman script, the one with a decoder. */
const WINDOWS_NAMES = new TextDecoder('utf-16be')
const MAC_ROMAN_NAMES = new TextDecoder('macintosh')
const MAC_ROMAN = 0
const NAME_HEADER_SIZE = 6
const NAME_RECORD_SIZE = 12
const FVAR_HEADER_SIZE = 16
const AXIS_RECORD_SIZE = 20

function sfntTable(view: DataView, tag: string): TableRange | null {
  if (view.byteLength < 12) return null
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16
    if (record + 16 > view.byteLength) return null
    let recordTag = ''
    for (let c = 0; c < 4; c++) recordTag += String.fromCharCode(view.getUint8(record + c))
    if (recordTag !== tag) continue
    const offset = view.getUint32(record + 8)
    const length = view.getUint32(record + 12)
    return offset + length <= view.byteLength ? { offset, length } : null
  }
  return null
}

/** One of the font's tables, or `null` when it has none. */
export function fontTableView(data: ArrayBuffer, tag: string): DataView | null {
  const table = sfntTable(new DataView(data), tag)
  return table ? new DataView(data, table.offset, table.length) : null
}

export function isVariableFont(data: ArrayBuffer): boolean {
  return sfntTable(new DataView(data), 'fvar') !== null
}

/** The sfnt versions of a font with TrueType outlines: 1.0, and Apple's `true`. */
const TRUETYPE_VERSIONS = new Set([0x00010000, 0x74727565])

/** Whether the file is a single font with TrueType outlines, not CFF (`OTTO`), WOFF, or a collection. */
export function hasTrueTypeOutlines(data: ArrayBuffer): boolean {
  return data.byteLength >= 12 && TRUETYPE_VERSIONS.has(new DataView(data).getUint32(0))
}

function fixed(view: DataView, offset: number): number {
  return view.getInt32(offset) / 65536
}

function fontName(view: DataView, name: TableRange, nameId: number): string | null {
  const end = name.offset + name.length
  if (name.length < NAME_HEADER_SIZE) return null
  const count = view.getUint16(name.offset + 2)
  const strings = name.offset + view.getUint16(name.offset + 4)
  if (name.offset + NAME_HEADER_SIZE + count * NAME_RECORD_SIZE > end) return null
  let fallback: string | null = null
  for (let i = 0; i < count; i++) {
    const record = name.offset + NAME_HEADER_SIZE + i * NAME_RECORD_SIZE
    if (view.getUint16(record + 6) !== nameId) continue
    const platform = view.getUint16(record)
    const language = view.getUint16(record + 4)
    const length = view.getUint16(record + 8)
    const start = strings + view.getUint16(record + 10)
    if (start + length > end) continue
    const bytes = new Uint8Array(view.buffer, view.byteOffset + start, length)
    if (platform === WINDOWS_PLATFORM) {
      const value = WINDOWS_NAMES.decode(bytes)
      if (language === ENGLISH_US) return value
      fallback ??= value
    } else if (platform === MAC_PLATFORM && view.getUint16(record + 2) === MAC_ROMAN) {
      fallback ??= MAC_ROMAN_NAMES.decode(bytes)
    }
  }
  return fallback
}

const FAMILY_NAME = 1
const SUBFAMILY_NAME = 2
const TYPOGRAPHIC_FAMILY_NAME = 16
const TYPOGRAPHIC_SUBFAMILY_NAME = 17

/**
 * The family and style a font file names itself with: its typographic names, which keep every
 * weight in one family, else the legacy ones, which group at most four styles per family.
 */
export function fontFaceName(data: ArrayBuffer): FontFamilyStyle | null {
  const view = new DataView(data)
  const name = sfntTable(view, 'name')
  if (!name) return null
  const family = fontName(view, name, TYPOGRAPHIC_FAMILY_NAME) ?? fontName(view, name, FAMILY_NAME)
  const style =
    fontName(view, name, TYPOGRAPHIC_SUBFAMILY_NAME) ?? fontName(view, name, SUBFAMILY_NAME)
  return family ? { family, style: style ?? 'Regular' } : null
}

/** A variation axis of a font: its tag, its range and default, and the name the font gives it. */
export interface FontAxis {
  tag: string
  min: number
  default: number
  max: number
  name: string
}

interface VariationTable {
  view: DataView
  axes: FontAxis[]
  /** Where each named instance's record starts. */
  instances: number[]
  name: TableRange | null
}

function variationTable(data: ArrayBuffer): VariationTable | null {
  const view = new DataView(data)
  const fvar = sfntTable(view, 'fvar')
  if (!fvar || fvar.length < FVAR_HEADER_SIZE) return null

  const axesOffset = fvar.offset + view.getUint16(fvar.offset + 4)
  const axisCount = view.getUint16(fvar.offset + 8)
  const axisSize = view.getUint16(fvar.offset + 10)
  const instanceCount = view.getUint16(fvar.offset + 12)
  const instanceSize = view.getUint16(fvar.offset + 14)
  if (axisSize < AXIS_RECORD_SIZE || instanceSize < 4 + axisCount * 4) return null
  if (
    axesOffset + axisCount * axisSize + instanceCount * instanceSize >
    fvar.offset + fvar.length
  ) {
    return null
  }

  const name = sfntTable(view, 'name')
  const axes = Array.from({ length: axisCount }, (_, index) => {
    const axis = axesOffset + index * axisSize
    let tag = ''
    for (let c = 0; c < 4; c++) tag += String.fromCharCode(view.getUint8(axis + c))
    return {
      tag,
      min: fixed(view, axis + 4),
      default: fixed(view, axis + 8),
      max: fixed(view, axis + 12),
      name: (name && fontName(view, name, view.getUint16(axis + 18))) ?? tag
    }
  })
  const instancesOffset = axesOffset + axisCount * axisSize
  const instances = Array.from(
    { length: instanceCount },
    (_, index) => instancesOffset + index * instanceSize
  )
  return { view, axes, instances, name }
}

/** The variation axes of a font, in its order, or `null` for a static font. */
export function fontAxes(data: ArrayBuffer): FontAxis[] | null {
  return variationTable(data)?.axes ?? null
}

/** A named instance of a variable font, such as Inter's `SemiBold`, with every axis' value. */
export interface NamedInstance {
  name: string
  variations: FontVariation[]
}

/** Whether a variable font has a named instance of this name, spelled alike but for case and spaces. */
export function hasNamedInstance(data: ArrayBuffer, style: string): boolean {
  return namedInstances(data).some(
    (instance) => styleSpelling(instance.name) === styleSpelling(style)
  )
}

/** A variable font's named instances, in its order. */
export function namedInstances(data: ArrayBuffer): NamedInstance[] {
  const table = variationTable(data)
  if (!table?.name) return []
  const { view, axes, instances, name } = table
  return instances.flatMap((offset) => {
    const instanceName = fontName(view, name, view.getUint16(offset))
    if (instanceName === null) return []
    const variations = axes.map((axis, axisIndex) => ({
      axis: axis.tag,
      value: fixed(view, offset + 4 + axisIndex * 4)
    }))
    return [{ name: instanceName, variations }]
  })
}

/**
 * Returns the axis coordinates a variable font needs to render `style`, preferring the named
 * instance with that name (for example SF Pro `Medium` is `wght` 510) and otherwise clamping the
 * style's weight to the `wght` axis. Returns `null` for static fonts.
 */
export function namedInstanceVariations(data: ArrayBuffer, style: string): FontVariation[] | null {
  const table = variationTable(data)
  if (!table) return null
  const { view, axes, instances, name } = table
  const requested = styleSpelling(style)
  const instance = name
    ? instances.find((offset) => {
        const instanceName = fontName(view, name, view.getUint16(offset))
        return instanceName !== null && styleSpelling(instanceName) === requested
      })
    : undefined
  if (instance !== undefined) {
    return axes.map((axis, axisIndex) => ({
      axis: axis.tag,
      value: fixed(view, instance + 4 + axisIndex * 4)
    }))
  }

  const weight = axes.find((axis) => axis.tag === 'wght')
  if (!weight) return []
  return [{ axis: 'wght', value: Math.min(weight.max, Math.max(weight.min, styleToWeight(style))) }]
}

/** An axis value the font's STAT table names: the axes it covers, each with its range. */
interface StatAxisValue {
  axes: Array<{ tag: string; min: number; max: number }>
  name: string
  /** Left out of a name, as "Regular" is left out of "Bold" for a regular-width roman. */
  elidable: boolean
}

const STAT_HEADER_SIZE = 18
const ELIDABLE_AXIS_VALUE = 0x0002

function statAxisValue(
  view: DataView,
  offset: number,
  tags: readonly string[],
  name: TableRange
): StatAxisValue | null {
  const format = view.getUint16(offset)
  const range = (axisIndex: number, min: number, max = min) => {
    const tag = tags.at(axisIndex)
    return tag === undefined ? null : { tag, min, max }
  }
  let axes: Array<{ tag: string; min: number; max: number } | null>
  let flags: number
  let nameId: number
  if (format === 1 || format === 3) {
    flags = view.getUint16(offset + 4)
    nameId = view.getUint16(offset + 6)
    axes = [range(view.getUint16(offset + 2), fixed(view, offset + 8))]
  } else if (format === 2) {
    flags = view.getUint16(offset + 4)
    nameId = view.getUint16(offset + 6)
    axes = [range(view.getUint16(offset + 2), fixed(view, offset + 12), fixed(view, offset + 16))]
  } else if (format === 4) {
    const count = view.getUint16(offset + 2)
    flags = view.getUint16(offset + 4)
    nameId = view.getUint16(offset + 6)
    axes = Array.from({ length: count }, (_, index) => {
      const record = offset + 8 + index * 6
      return range(view.getUint16(record), fixed(view, record + 2))
    })
  } else {
    return null
  }
  const valueName = fontName(view, name, nameId)
  if (valueName === null || axes.some((axis) => axis === null)) return null
  return {
    axes: axes.filter((axis) => axis !== null),
    name: valueName,
    elidable: (flags & ELIDABLE_AXIS_VALUE) !== 0
  }
}

/**
 * Names a point in the font's design space as its STAT table names it, the way Windows names a
 * variable font's instances: each design axis's value name in the table's axis order, leaving
 * out the elidable ones, so Segoe UI Variable's instance the font calls "Bold Display" is
 * "Display Bold", and its regular Display instance just "Display". An axis the point does not
 * set takes the one value the table gives it, as an italic file's "Italic". `null` for a font
 * without a STAT table.
 */
export function statNamer(data: ArrayBuffer): ((variations: FontVariation[]) => string) | null {
  const view = new DataView(data)
  const stat = sfntTable(view, 'STAT')
  const name = sfntTable(view, 'name')
  if (!stat || !name || stat.length < STAT_HEADER_SIZE) return null
  const minor = view.getUint16(stat.offset + 2)
  const axisSize = view.getUint16(stat.offset + 4)
  const axisCount = view.getUint16(stat.offset + 6)
  const axesOffset = stat.offset + view.getUint32(stat.offset + 8)
  const valueCount = view.getUint16(stat.offset + 12)
  const valuesOffset = stat.offset + view.getUint32(stat.offset + 14)
  const end = stat.offset + stat.length
  if (axesOffset + axisCount * axisSize > end || valuesOffset + valueCount * 2 > end) return null

  const designAxes = Array.from({ length: axisCount }, (_, index) => {
    const record = axesOffset + index * axisSize
    let tag = ''
    for (let c = 0; c < 4; c++) tag += String.fromCharCode(view.getUint8(record + c))
    return { tag, ordering: view.getUint16(record + 6) }
  })
  const tags = designAxes.map((axis) => axis.tag)
  const values = Array.from({ length: valueCount }, (_, index) => {
    const offset = valuesOffset + view.getUint16(valuesOffset + index * 2)
    return offset + 8 <= end ? statAxisValue(view, offset, tags, name) : null
  }).filter((value) => value !== null)
  const fallback =
    (minor >= 1 && stat.length >= 20 && fontName(view, name, view.getUint16(stat.offset + 18))) ||
    'Regular'
  const ordering = new Map(designAxes.map((axis) => [axis.tag, axis.ordering]))

  return (variations) => {
    const at = new Map(variations.map(({ axis, value }) => [axis, value]))
    const holds = (axis: StatAxisValue['axes'][number]) => {
      const value = at.get(axis.tag)
      if (value !== undefined) return value >= axis.min && value <= axis.max
      // An axis the point leaves unset is named by the font's one value for it.
      return values.filter((other) => other.axes.some(({ tag }) => tag === axis.tag)).length === 1
    }
    const named = new Set<string>()
    const parts: Array<{ ordering: number; name: string }> = []
    const take = (value: StatAxisValue) => {
      for (const { tag } of value.axes) named.add(tag)
      if (value.elidable) return
      const first = value.axes.reduce(
        (lowest, { tag }) => Math.min(lowest, ordering.get(tag) ?? 0),
        Number.POSITIVE_INFINITY
      )
      parts.push({ ordering: first, name: value.name })
    }
    // A value naming several axes at once names them before any single-axis value does.
    for (const value of values) {
      if (value.axes.length > 1 && value.axes.every(holds)) take(value)
    }
    for (const axis of designAxes) {
      if (named.has(axis.tag)) continue
      const value = values.find(
        (candidate) =>
          candidate.axes.length === 1 &&
          candidate.axes[0]?.tag === axis.tag &&
          holds(candidate.axes[0])
      )
      if (value) take(value)
    }
    const words = parts.toSorted((a, b) => a.ordering - b.ordering).map((part) => part.name)
    return words.length > 0 ? words.join(' ') : fallback
  }
}
