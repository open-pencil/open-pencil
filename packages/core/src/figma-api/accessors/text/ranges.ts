import { uniqBy } from 'es-toolkit/array'

import type {
  CharacterStyleOverride,
  Fill,
  HyperlinkTarget,
  SceneGraph,
  SceneNode,
  TextBindableField,
  TextCase,
  TextDecoration,
  TextDecorationStyle,
  TextLength
} from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

import {
  assertProxyEditable,
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { assertFontLoaded, assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import {
  fontNameInputStyle,
  type CurrentFont,
  type FigmaFontName,
  type FigmaFontNameInput
} from '#core/figma-api/fonts/names'
import {
  readVariationSettings,
  type FigmaVariationSettings
} from '#core/figma-api/fonts/variations'
import { parseFigmaPaints, type FigmaPaint } from '#core/figma-api/paints'
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
  type FigmaDecorationColor,
  type FigmaTextLength,
  type StyledTextSegment,
  type TextSegmentField
} from '#core/figma-api/text/style'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'
import {
  characterStyles,
  nodeStyle,
  styleRunsWithPatch,
  type TextStylePatch
} from '#core/text/character-style'
import { textStyleName } from '#core/text/font/names'

import { hyperlinkTarget } from './hyperlink'
import { invalid, received } from './messages'
import { installTextReferenceMethods } from './references'

const DECORATIONS = new Set<TextDecoration>(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
const DECORATION_STYLES = new Set<TextDecorationStyle>(['SOLID', 'DOTTED', 'WAVY'])
const LENGTH_UNITS = new Set(['PIXELS', 'PERCENT'])
const TEXT_CASES = new Set<TextCase>(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
/** Text cases Figma takes that OpenPencil cannot draw yet. */
const SMALL_CAPS = new Set(['SMALL_CAPS', 'SMALL_CAPS_FORCED'])
const PAINT_TYPES = new Set([
  'SOLID',
  'SHADER',
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND',
  'IMAGE',
  'VIDEO'
])
const SOLID_PAINT_KEYS = new Set([
  'type',
  'color',
  'opacity',
  'visible',
  'blendMode',
  'boundVariables'
])

function numberProblem(value: unknown, at = ''): string | null {
  if (value === undefined) return `Required value missing${at}`
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `Expected number, received ${received(value)}${at}`
  }
  return null
}

/** A length in pixels for a font size: a percent is of the size of the characters it styles. */
type SizedLength<T> = (fontSize: number) => T

function lengthFor(value: { unit: 'PIXELS' | 'PERCENT'; value: number }): TextLength {
  return { unit: value.unit, value: value.value }
}

/** `length` in pixels at the size of the characters it styles, for fields kept in pixels. */
function sized(length: TextLength | null): SizedLength<number | null> {
  return (fontSize) => length && textLengthPixels(length, fontSize)
}

/** A letter spacing Figma takes: pixels or percent, never automatic. */
function letterSpacingLength(method: string, value: unknown): TextLength {
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
function lengthOrAuto(method: string, value: unknown): TextLength | null {
  const length = value as Partial<FigmaTextLength & { value: number }> | null
  if (!length || typeof length !== 'object') {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  if (length.unit === 'AUTO') return null
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

/** The font Figma reads for the character at `index`, as a font name left out reads from. */
/** The font of the character at `index`, and the axes it sets itself. */
function currentFont(node: SceneNode, index: number): CurrentFont {
  const at = Math.min(index, node.text.length - 1)
  const [style] = at < 0 ? [nodeStyle(node)] : characterStyles(node, at, at + 1)
  const name = textStyleName(style)
  return {
    style: name,
    fontVariations: style.fontVariations,
    variationSettings: readVariationSettings(
      style.fontFamily,
      name,
      style.fontVariations,
      style.opticalSizeFromFontSize
    )
  }
}

/**
 * A font name Figma takes: a family, and a style and variation settings that may be left out, as
 * in `FontNameInput`. What is left out reads from the font of the character at `start`.
 */
export function fontNameStyle(
  method: string,
  node: SceneNode,
  start: number,
  value: unknown
): CharacterStyleOverride {
  if (!value || typeof value !== 'object') {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  const fontName = value as Partial<Record<keyof FigmaFontName, unknown>>
  const problem =
    stringProblem(fontName.family, '.family') ??
    (fontName.style === undefined ? null : stringProblem(fontName.style, '.style')) ??
    variationSettingsProblem(fontName.variationSettings)
  if (problem) throw invalid(method, problem)
  return fontNameInputStyle(
    method,
    {
      family: fontName.family as string,
      style: fontName.style as string | undefined,
      variationSettings: fontName.variationSettings as FigmaVariationSettings | undefined
    },
    currentFont(node, start)
  )
}

/** Variation settings Figma takes: numbers by axis tag. */
function variationSettingsProblem(value: unknown): string | null {
  if (value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `Expected object, received ${received(value)} at .variationSettings`
  }
  for (const [tag, setting] of Object.entries(value)) {
    const problem = numberProblem(setting, ` at .variationSettings.${tag}`)
    if (problem) return problem
  }
  return null
}

/** A number from 0 to 1, as Figma takes colour channels and opacity. */
function unitProblem(value: unknown, at: string): string | null {
  const problem = numberProblem(value, ` at ${at}`)
  if (problem) return problem
  if ((value as number) < 0) return `Number must be greater than or equal to 0 at ${at}`
  if ((value as number) > 1) return `Number must be less than or equal to 1 at ${at}`
  return null
}

/** A solid paint's colour and opacity as Figma checks them; a colour's alpha may be left out. */
function solidPaintProblem(paint: { color?: unknown; opacity?: unknown }, at: string) {
  const { color, opacity } = paint
  if (color === undefined) return `Required value missing at ${at}.color`
  if (!color || typeof color !== 'object') {
    return `Expected object, received ${received(color)} at ${at}.color`
  }
  const channels = color as Partial<Record<'r' | 'g' | 'b' | 'a', unknown>>
  for (const channel of ['r', 'g', 'b', 'a'] as const) {
    if (channel === 'a' && channels.a === undefined) continue
    const problem = unitProblem(channels[channel], `${at}.color.${channel}`)
    if (problem) return problem
  }
  return opacity === undefined ? null : unitProblem(opacity, `${at}.opacity`)
}

function paintProblem(paint: unknown, index: number): string | null {
  if (!paint || typeof paint !== 'object') {
    return `Expected object, received ${received(paint)} at index ${index}`
  }
  const { type } = paint as { type?: unknown }
  if (!PAINT_TYPES.has(type as string)) {
    return `Invalid discriminator value. Expected ${[...PAINT_TYPES].map((name) => `'${name}'`).join(' | ')} at [${index}].type`
  }
  return type === 'SOLID' ? solidPaintProblem(paint, `[${index}]`) : null
}

function fillsFromPaints(method: string, value: unknown): CharacterStyleOverride['fills'] {
  if (!Array.isArray(value)) throw invalid(method, `Expected array, received ${received(value)}`)
  for (const [index, paint] of value.entries()) {
    const problem = paintProblem(paint, index)
    if (problem) throw invalid(method, problem)
  }
  return parseFigmaPaints(value, method, 'value')
}

/**
 * A decoration colour Figma takes: `AUTO`, or a solid paint. A paint matching but for keys it
 * does not know reports only those; any other is reported against both choices.
 */
function decorationColorFills(method: string, value: unknown): Fill[] {
  const color = (value as { value?: unknown } | null)?.value
  if (color === 'AUTO') return []
  const issues: string[] = []
  if (!color || typeof color !== 'object') {
    issues.push(`Expected object, received ${received(color)} at .value`)
  } else {
    const paint = color as Partial<Record<'type' | 'color', unknown>>
    if (paint.type !== 'SOLID')
      issues.push('Invalid literal value, expected "SOLID" at .value.type')
    if (paint.color === undefined) issues.push('Required value missing at .value.color')
    else if (!paint.color || typeof paint.color !== 'object') {
      issues.push(`Expected object, received ${received(paint.color)} at .value.color`)
    }
    const unknown = Object.keys(paint).filter((key) => !SOLID_PAINT_KEYS.has(key))
    if (unknown.length > 0) {
      const keys = unknown.map((key) => `'${key}'`).join(', ')
      if (issues.length === 0) {
        throw invalid(
          method,
          `Unrecognized key(s) in object: ${keys} at .value`,
          'textDecorationColor'
        )
      }
      issues.push(`Unrecognized key(s) in object: ${keys} at .value`)
    }
  }
  if (issues.length === 0) {
    // A solid paint whose channels are out of range fails on them alone.
    const problem = solidPaintProblem(color as { color?: unknown; opacity?: unknown }, '.value')
    if (problem) throw invalid(method, problem, 'textDecorationColor')
    return parseFigmaPaints([color], method, 'textDecorationColor')
  }
  const paintIssues =
    issues.length === 1
      ? `  ${issues[0]}`
      : `  Multiple issues:\n${issues.map((issue) => `    ${issue}`).join('\n')}`
  throw invalid(
    method,
    `Expected one of the following, but none matched:\n${paintIssues}\n` +
      '  Invalid literal value, expected "AUTO" at .value',
    'textDecorationColor'
  )
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

type RangeSetter = (
  method: string,
  node: SceneNode,
  start: number,
  end: number,
  value: unknown,
  graph: SceneGraph
) => TextStylePatch

/** Decoration styles only apply to underlined text; Figma rejects a range with none. */
function underlineStyle(
  name: string,
  patch: (method: string, value: unknown) => TextStylePatch
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
  setRangeFontName: (method, node, start, _end, value) => {
    const style = fontNameStyle(method, node, start, value)
    assertFontLoaded(method, node, style)
    return style
  },
  setRangeFills: (method, _node, _start, _end, value) => ({
    fills: fillsFromPaints(method, value)
  }),
  // A percent stays a percent, following the size of the characters it styles, as in Figma.
  setRangeLetterSpacing: (method, _node, _start, _end, value) => ({
    letterSpacing: letterSpacingLength(method, value)
  }),
  setRangeLineHeight: (method, _node, _start, _end, value) => ({
    lineHeight: lengthOrAuto(method, value)
  }),
  setRangeTextDecoration: (method, _node, _start, _end, value) => ({
    textDecoration: enumValue(method, value, DECORATIONS)
  }),
  setRangeTextDecorationStyle: underlineStyle('style', (method, value) => ({
    textDecorationStyle: enumValue(method, value, DECORATION_STYLES)
  })),
  setRangeTextDecorationOffset: underlineStyle('offset', (method, value) => {
    const length = sized(lengthOrAuto(method, value))
    return (fontSize) => ({ textUnderlineOffset: length(fontSize) })
  }),
  setRangeTextDecorationThickness: underlineStyle('thickness', (method, value) => {
    const length = sized(lengthOrAuto(method, value))
    return (fontSize) => ({ textDecorationThickness: length(fontSize) })
  }),
  setRangeTextDecorationColor: underlineStyle('color', (method, value) => ({
    textDecorationFills: decorationColorFills(method, value)
  })),
  setRangeTextDecorationSkipInk: underlineStyle('skip ink', (method, value) => {
    if (typeof value !== 'boolean')
      throw invalid(method, `Expected boolean, received ${received(value)}`)
    return { textDecorationSkipInk: value }
  }),
  setRangeTextCase: (method, _node, _start, _end, value) => {
    if (SMALL_CAPS.has(value as string)) {
      throw new Error(`in ${method}: OpenPencil does not support the ${String(value)} text case`)
    }
    if (!TEXT_CASES.has(value as TextCase)) {
      throw invalid(
        method,
        `Invalid enum value. Expected ${[...TEXT_CASES, ...SMALL_CAPS].map((name) => `'${name}'`).join(' | ')}, received '${String(value)}'`
      )
    }
    return { textCase: value as TextCase }
  },
  setRangeHyperlink: (method, _node, _start, _end, value, graph) => ({
    hyperlink: hyperlinkTarget(method, value, graph)
  })
}

/** Range setters Figma takes with the text's fonts unloaded: paints and links, measured live. */
const RANGE_SETTERS_WITHOUT_FONTS = new Set([
  'setRangeFills',
  'setRangeHyperlink',
  'setRangeTextDecorationColor'
])

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
  getRangeOpenTypeFeatures: 'openTypeFeatures',
  getRangeTextCase: 'textCase',
  getRangeHyperlink: 'hyperlink',
  getRangeTextStyleId: 'textStyleId',
  getRangeFillStyleId: 'fillStyleId'
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
  setRangeFontName: RangeSetterMethod<FigmaFontNameInput>
  getRangeFontWeight: RangeGetter<number>
  getRangeFills: RangeGetter<FigmaPaint[]>
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
  getRangeTextCase: RangeGetter<TextCase>
  setRangeTextCase: RangeSetterMethod<TextCase>
  getRangeHyperlink: RangeGetter<HyperlinkTarget | null>
  setRangeHyperlink: RangeSetterMethod<HyperlinkTarget | null>
  getRangeTextStyleId: RangeGetter<string>
  setRangeTextStyleId: RangeSetterMethod<string>
  setRangeTextStyleIdAsync: (start: number, end: number, styleId: string) => Promise<void>
  getRangeFillStyleId: RangeGetter<string>
  setRangeFillStyleId: RangeSetterMethod<string>
  setRangeFillStyleIdAsync: (start: number, end: number, styleId: string) => Promise<void>
  getRangeBoundVariable: (
    start: number,
    end: number,
    field: TextBindableField
  ) => FigmaVariableAlias | null | symbol
  setRangeBoundVariable: (
    start: number,
    end: number,
    field: TextBindableField,
    variable: { readonly id: string } | null
  ) => void
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
        const patch = setter(method, node, start, end, value, graph(this, internals))
        if (!RANGE_SETTERS_WITHOUT_FONTS.has(method)) assertTextFontsLoaded(method, node)
        updateNode(this, internals, { styleRuns: styleRunsWithPatch(node, start, end, patch) })
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
  installTextReferenceMethods(methods, internals, mixed)
  Object.defineProperties(prototype, methods)
}
