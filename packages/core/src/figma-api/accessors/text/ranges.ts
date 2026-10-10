import { uniqBy } from 'es-toolkit/array'

import type {
  CharacterStyleOverride,
  Fill,
  SceneNode,
  TextDecoration,
  TextDecorationStyle
} from '@open-pencil/scene-graph'

import {
  assertProxyEditable,
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { figmaPaintToFill, type FigmaPaint } from '#core/figma-api/accessors/visual'
import { styleNameToWeight, type FigmaFontName } from '#core/figma-api/fonts'
import {
  getRangeIndentation,
  getRangeListOptions,
  getRangeParagraphSpacing,
  setRangeIndentation,
  setRangeListOptions,
  setRangeParagraphSpacing,
  type FigmaLetterSpacing
} from '#core/figma-api/text'
import {
  assertTextRange,
  getRangeTextStyle,
  getStyledTextSegments,
  rangeHasUnderline,
  styleRunsWithPatch,
  styleRunsWithSizedPatch,
  type FigmaDecorationColor,
  type FigmaTextLength,
  type StyledTextSegment,
  type TextSegmentField
} from '#core/figma-api/text/style'

const DECORATIONS = new Set<TextDecoration>(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
const DECORATION_STYLES = new Set<TextDecorationStyle>(['SOLID', 'DOTTED', 'WAVY'])
const LENGTH_UNITS = new Set(['PIXELS', 'PERCENT'])

/** Figma's message for a value its schema rejects. */
function invalid(method: string, problem: string, property = 'value'): Error {
  return new Error(`in ${method}: Property "${property}" failed validation: ${problem}`)
}

function received(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'nan'
  if (Array.isArray(value)) return 'array'
  return value === null ? 'null' : typeof value
}

function numberProblem(value: unknown, at = ''): string | null {
  if (value === undefined) return `Required value missing${at}`
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `Expected number, received ${received(value)}${at}`
  }
  return null
}

/** A length in pixels for a font size: a percent is of the size of the characters it styles. */
type SizedLength<T> = (fontSize: number) => T

function lengthFor(value: { unit: 'PIXELS' | 'PERCENT'; value: number }): SizedLength<number> {
  return (fontSize) => (value.unit === 'PERCENT' ? (value.value / 100) * fontSize : value.value)
}

/** A letter spacing Figma takes: pixels or percent, never automatic. */
function letterSpacingLength(method: string, value: unknown): SizedLength<number> {
  const length = value as Partial<FigmaTextLength & { value: number }> | null
  if (!length || typeof length !== 'object') {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  if (!LENGTH_UNITS.has(String(length.unit))) {
    throw invalid(
      method,
      `Invalid enum value. Expected 'PIXELS' | 'PERCENT', received '${String(length.unit)}' at .unit`
    )
  }
  const problem = numberProblem(length.value, ' at .value')
  if (problem) throw invalid(method, problem)
  return lengthFor(length as { unit: 'PIXELS' | 'PERCENT'; value: number })
}

/** A length that may also be automatic, as line heights and decoration sizes are. */
function lengthOrAuto(method: string, value: unknown): SizedLength<number | null> {
  const length = value as Partial<FigmaTextLength & { value: number }> | null
  if (!length || typeof length !== 'object') {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  if (length.unit === 'AUTO') return () => null
  if (!LENGTH_UNITS.has(String(length.unit))) {
    throw invalid(
      method,
      `Invalid discriminator value. Expected 'PIXELS' | 'PERCENT' | 'AUTO' at .unit`
    )
  }
  const problem = numberProblem(length.value, ' at .value')
  if (problem) throw invalid(method, problem)
  return lengthFor(length as { unit: 'PIXELS' | 'PERCENT'; value: number })
}

function stringProblem(value: unknown, at: string): string | null {
  return typeof value === 'string' ? null : `Expected string, received ${received(value)} at ${at}`
}

/** A font name Figma takes: a family and style; a style left out reads as regular. */
function fontNameStyle(method: string, value: unknown): CharacterStyleOverride {
  if (!value || typeof value !== 'object') {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  const fontName = value as Partial<Record<keyof FigmaFontName, unknown>>
  const style = fontName.style ?? 'Regular'
  const problem = stringProblem(fontName.family, '.family') ?? stringProblem(style, '.style')
  if (problem) throw invalid(method, problem)
  const { weight, italic } = styleNameToWeight(style as string)
  return { fontFamily: fontName.family as string, fontWeight: weight, italic }
}

function fillsFromPaints(method: string, value: unknown): CharacterStyleOverride['fills'] {
  if (!Array.isArray(value)) throw invalid(method, `Expected array, received ${received(value)}`)
  for (const [index, paint] of (value as FigmaPaint[]).entries()) {
    for (const channel of ['r', 'g', 'b', 'a'] as const) {
      const component = paint.color?.[channel]
      if (component !== undefined && component > 1) {
        throw invalid(
          method,
          `Number must be less than or equal to 1 at [${index}].color.${channel}`
        )
      }
    }
  }
  return (value as FigmaPaint[]).map(figmaPaintToFill)
}

function enumValue<T extends string>(method: string, value: unknown, allowed: ReadonlySet<T>): T {
  if (!(allowed as ReadonlySet<unknown>).has(value)) {
    throw invalid(
      method,
      `Invalid enum value. Expected ${[...allowed].map((name) => `'${name}'`).join(' | ')}, received '${String(value)}'`
    )
  }
  return value as T
}

/** A style for the range, or one per font size for lengths given in percent. */
type StylePatch = CharacterStyleOverride | ((fontSize: number) => CharacterStyleOverride)

type RangeSetter = (
  method: string,
  node: SceneNode,
  start: number,
  end: number,
  value: unknown
) => StylePatch

/** Decoration styles only apply to underlined text; Figma rejects a range with none. */
function underlineStyle(
  name: string,
  patch: (method: string, value: unknown) => StylePatch
): RangeSetter {
  return (method, node, start, end, value) => {
    const style = patch(method, value)
    if (!rangeHasUnderline(node, start, end)) {
      throw new Error(
        `in ${method}: Cannot set text decoration ${name} on a non-underlined text range`
      )
    }
    return style
  }
}

/** Range setters by method, each returning the style it gives the range. */
const RANGE_SETTERS: Record<string, RangeSetter> = {
  setRangeFontSize: (method, _node, _start, _end, value) => {
    const problem = numberProblem(value)
    if (problem) throw invalid(method, problem)
    if ((value as number) < 1) throw invalid(method, 'Number must be greater than or equal to 1')
    return { fontSize: value as number }
  },
  setRangeFontName: (method, _node, _start, _end, value) => fontNameStyle(method, value),
  setRangeFills: (method, _node, _start, _end, value) => ({
    fills: fillsFromPaints(method, value)
  }),
  setRangeLetterSpacing: (method, _node, _start, _end, value) => {
    const length = letterSpacingLength(method, value)
    return (fontSize) => ({ letterSpacing: length(fontSize) })
  },
  setRangeLineHeight: (method, _node, _start, _end, value) => {
    const length = lengthOrAuto(method, value)
    return (fontSize) => ({ lineHeight: length(fontSize) })
  },
  setRangeTextDecoration: (method, _node, _start, _end, value) => ({
    textDecoration: enumValue(method, value, DECORATIONS)
  }),
  setRangeTextDecorationStyle: underlineStyle('style', (method, value) => ({
    textDecorationStyle: enumValue(method, value, DECORATION_STYLES)
  })),
  setRangeTextDecorationOffset: underlineStyle('offset', (method, value) => {
    const length = lengthOrAuto(method, value)
    return (fontSize) => ({ textUnderlineOffset: length(fontSize) })
  }),
  setRangeTextDecorationThickness: underlineStyle('thickness', (method, value) => {
    const length = lengthOrAuto(method, value)
    return (fontSize) => ({ textDecorationThickness: length(fontSize) })
  }),
  setRangeTextDecorationColor: underlineStyle('color', (method, value) => {
    const color = (value as { value?: unknown } | null)?.value
    if (color === 'AUTO') return { textDecorationFills: [] }
    if (!color || typeof color !== 'object') {
      throw invalid(
        method,
        'Expected one of the following, but none matched:\n' +
          `  Expected object, received ${received(color)} at .value\n` +
          '  Invalid literal value, expected "AUTO" at .value',
        'textDecorationColor'
      )
    }
    return { textDecorationFills: fillsFromPaints(method, [color]) }
  }),
  setRangeTextDecorationSkipInk: underlineStyle('skip ink', (method, value) => {
    if (typeof value !== 'boolean')
      throw invalid(method, `Expected boolean, received ${received(value)}`)
    return { textDecorationSkipInk: value }
  })
}

/** Range getters by method and the segment field each reads. */
const RANGE_GETTERS: Record<string, TextSegmentField> = {
  getRangeFontSize: 'fontSize',
  getRangeFontName: 'fontName',
  getRangeFontWeight: 'fontWeight',
  getRangeFills: 'fills',
  getRangeLetterSpacing: 'letterSpacing',
  getRangeLineHeight: 'lineHeight',
  getRangeTextDecoration: 'textDecoration',
  getRangeTextDecorationStyle: 'textDecorationStyle',
  getRangeTextDecorationOffset: 'textDecorationOffset',
  getRangeTextDecorationThickness: 'textDecorationThickness',
  getRangeTextDecorationColor: 'textDecorationColor',
  getRangeTextDecorationSkipInk: 'textDecorationSkipInk',
  getRangeOpenTypeFeatures: 'openTypeFeatures'
}

type RangeGetter<T> = (start: number, end: number) => T | symbol
type RangeSetterMethod<T> = (start: number, end: number, value: T) => void

/** Figma's per-character and per-paragraph text methods, as the node proxy exposes them. */
export interface TextRangeMethods {
  getStyledTextSegments: (
    fields: TextSegmentField[],
    start?: number,
    end?: number
  ) => StyledTextSegment[]
  getRangeAllFontNames: (start: number, end: number) => FigmaFontName[]
  getRangeFontSize: RangeGetter<number>
  setRangeFontSize: RangeSetterMethod<number>
  getRangeFontName: RangeGetter<FigmaFontName>
  setRangeFontName: RangeSetterMethod<FigmaFontName>
  getRangeFontWeight: RangeGetter<number>
  getRangeFills: RangeGetter<Fill[]>
  setRangeFills: RangeSetterMethod<FigmaPaint[]>
  getRangeLetterSpacing: RangeGetter<FigmaLetterSpacing>
  setRangeLetterSpacing: RangeSetterMethod<FigmaLetterSpacing>
  getRangeLineHeight: RangeGetter<FigmaTextLength>
  setRangeLineHeight: RangeSetterMethod<FigmaTextLength>
  getRangeTextDecoration: RangeGetter<TextDecoration>
  setRangeTextDecoration: RangeSetterMethod<TextDecoration>
  getRangeTextDecorationStyle: RangeGetter<TextDecorationStyle | null>
  setRangeTextDecorationStyle: RangeSetterMethod<TextDecorationStyle>
  getRangeTextDecorationOffset: RangeGetter<FigmaTextLength | null>
  setRangeTextDecorationOffset: RangeSetterMethod<FigmaTextLength>
  getRangeTextDecorationThickness: RangeGetter<FigmaTextLength | null>
  setRangeTextDecorationThickness: RangeSetterMethod<FigmaTextLength>
  getRangeTextDecorationColor: RangeGetter<FigmaDecorationColor | null>
  setRangeTextDecorationColor: RangeSetterMethod<{ value: 'AUTO' } | { value: FigmaPaint }>
  getRangeTextDecorationSkipInk: RangeGetter<boolean | null>
  setRangeTextDecorationSkipInk: RangeSetterMethod<boolean>
  getRangeOpenTypeFeatures: RangeGetter<Record<string, boolean>>
  getRangeListOptions: RangeGetter<TextListOptions>
  setRangeListOptions: RangeSetterMethod<TextListOptions>
  getRangeIndentation: RangeGetter<number>
  setRangeIndentation: RangeSetterMethod<number>
  getRangeListSpacing: RangeGetter<number>
  setRangeListSpacing: RangeSetterMethod<number>
  getRangeParagraphSpacing: RangeGetter<number>
  setRangeParagraphSpacing: RangeSetterMethod<number>
  getRangeParagraphIndent: RangeGetter<number>
  setRangeParagraphIndent: RangeSetterMethod<number>
}

const PARAGRAPH_SPACING_METHODS = {
  ListSpacing: 'listSpacing',
  ParagraphSpacing: 'paragraphSpacing',
  ParagraphIndent: 'paragraphIndent'
} as const

/** Installs Figma's per-character and per-paragraph text methods on the node proxy. */
export function installTextRangeMethods(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  const methods: PropertyDescriptorMap = {}
  for (const [method, field] of Object.entries(RANGE_GETTERS)) {
    methods[method] = {
      value(this: ProxyThis, start: number, end: number) {
        return getRangeTextStyle(method, raw(this, internals), field, start, end, mixed)
      }
    }
  }
  for (const [method, setter] of Object.entries(RANGE_SETTERS)) {
    methods[method] = {
      value(this: ProxyThis, start: number, end: number, value: unknown) {
        const node = raw(this, internals)
        assertTextRange(method, node, start, end)
        const patch = setter(method, node, start, end, value)
        const styleRuns =
          typeof patch === 'function'
            ? styleRunsWithSizedPatch(node, start, end, patch)
            : styleRunsWithPatch(node, start, end, patch)
        updateNode(this, internals, { styleRuns })
      }
    }
  }
  methods.getRangeAllFontNames = {
    value(this: ProxyThis, start: number, end: number) {
      const node = raw(this, internals)
      assertTextRange('getRangeAllFontNames', node, start, end)
      const names = getStyledTextSegments(node, ['fontName'], start, end).map(
        (segment) => segment.fontName as FigmaFontName
      )
      return uniqBy(names, (name) => `${name.family}\u0000${name.style}`)
    }
  }
  methods.getStyledTextSegments = {
    value(this: ProxyThis, fields: TextSegmentField[], start?: number, end?: number) {
      return getStyledTextSegments(raw(this, internals), fields, start, end)
    }
  }
  methods.getRangeListOptions = {
    value(this: ProxyThis, start: number, end: number) {
      return getRangeListOptions(raw(this, internals), start, end, mixed)
    }
  }
  methods.setRangeListOptions = {
    value(this: ProxyThis, start: number, end: number, value: TextListOptions) {
      assertProxyEditable(this, internals)
      setRangeListOptions(graph(this, internals), raw(this, internals), start, end, value)
    }
  }
  methods.getRangeIndentation = {
    value(this: ProxyThis, start: number, end: number) {
      return getRangeIndentation(raw(this, internals), start, end, mixed)
    }
  }
  methods.setRangeIndentation = {
    value(this: ProxyThis, start: number, end: number, value: number) {
      assertProxyEditable(this, internals)
      setRangeIndentation(graph(this, internals), raw(this, internals), start, end, value)
    }
  }
  for (const [name, field] of Object.entries(PARAGRAPH_SPACING_METHODS)) {
    methods[`getRange${name}`] = {
      value(this: ProxyThis, start: number, end: number) {
        return getRangeParagraphSpacing(raw(this, internals), field, start, end, mixed)
      }
    }
    methods[`setRange${name}`] = {
      value(this: ProxyThis, start: number, end: number, value: number) {
        assertProxyEditable(this, internals)
        setRangeParagraphSpacing(
          graph(this, internals),
          raw(this, internals),
          field,
          start,
          end,
          value
        )
      }
    }
  }
  Object.defineProperties(prototype, methods)
}
