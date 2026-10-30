import type { FontVariation } from '@open-pencil/scene-graph'
import { styleToWeight } from '@open-pencil/scene-graph/font-style'

interface TableRange {
  offset: number
  length: number
}

const WINDOWS_PLATFORM = 3
const MAC_PLATFORM = 1
const ENGLISH_US = 0x409
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

function normalizeStyleName(style: string): string {
  return style.toLowerCase().replace(/\s+/g, '')
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
      let value = ''
      for (let c = 0; c + 1 < length; c += 2)
        value += String.fromCharCode((bytes[c] << 8) | bytes[c + 1])
      if (language === ENGLISH_US) return value
      fallback ??= value
    } else if (platform === MAC_PLATFORM) {
      fallback ??= String.fromCharCode(...bytes)
    }
  }
  return fallback
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
  const requested = normalizeStyleName(style)
  const instance = name
    ? instances.find((offset) => {
        const instanceName = fontName(view, name, view.getUint16(offset))
        return instanceName !== null && normalizeStyleName(instanceName) === requested
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
