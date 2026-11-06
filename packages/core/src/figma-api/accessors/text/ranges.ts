import type { TextListOptions } from '@figma/plugin-typings/plugin-api-standalone'
import { uniqBy } from 'es-toolkit/array'

import type {
  CharacterStyleOverride,
  HyperlinkTarget,
  SceneGraph,
  SceneNode,
  TextBindableField,
  TextCase,
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
import { assertFontLoaded, assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import {
  fontNameInputStyle,
  type CurrentFont,
  type FigmaFontName,
  type FigmaFontNameInput
} from '#core/figma-api/fonts/names'
import { readVariationSettings } from '#core/figma-api/fonts/variations'
import type { FigmaPaint } from '#core/figma-api/paints'
import { fontNameSchema } from '#core/figma-api/schema'
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
  type FigmaDecorationColor,
  type FigmaTextLength,
  type StyledTextSegment,
  type TextSegmentField
} from '#core/figma-api/text/style'
import { parseFigma } from '#core/figma-api/validation'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'
import {
  characterStyles,
  nodeStyle,
  styleRunsWithPatch,
  type TextStylePatch
} from '#core/text/character-style'
import { textStyleName } from '#core/text/font/names'

import { rangeDecorationPatch, type DecorationField } from './decoration'
import { hyperlinkTarget } from './hyperlink'
import { installTextReferenceMethods } from './references'
import {
  DECORATIONS,
  enumValue,
  fillsFromPaints,
  fontSizeValue,
  lengthOrAuto,
  letterSpacingLength,
  textCaseValue
} from './values'

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
  value: unknown,
  property = 'value'
): CharacterStyleOverride {
  const fontName = parseFigma(fontNameSchema, value, method, property)
  return fontNameInputStyle(method, fontName, currentFont(node, start))
}

type RangeSetter = (
  method: string,
  node: SceneNode,
  start: number,
  end: number,
  value: unknown,
  graph: SceneGraph
) => TextStylePatch

/** A `setRangeTextDecoration*` method's setter. */
function underlineStyle(field: DecorationField): RangeSetter {
  return (method, node, start, end, value) =>
    rangeDecorationPatch(field, method, node, start, end, value)
}

/** Range setters by method, each returning the style it gives the range. */
const RANGE_SETTERS: Record<string, RangeSetter> = {
  setRangeFontSize: (method, _node, _start, _end, value) => ({
    fontSize: fontSizeValue(method, value)
  }),
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
  setRangeTextDecorationStyle: underlineStyle('textDecorationStyle'),
  setRangeTextDecorationOffset: underlineStyle('textDecorationOffset'),
  setRangeTextDecorationThickness: underlineStyle('textDecorationThickness'),
  setRangeTextDecorationColor: underlineStyle('textDecorationColor'),
  setRangeTextDecorationSkipInk: underlineStyle('textDecorationSkipInk'),
  setRangeTextCase: (method, _node, _start, _end, value) => ({
    textCase: textCaseValue(method, value, 'textCase')
  }),
  setRangeHyperlink: (method, _node, _start, _end, value, graph) => ({
    hyperlink: hyperlinkTarget(method, value, graph, 'hyperlink')
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
