import { omit } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import {
  paragraphIndexAt,
  paragraphSpacingAt,
  paragraphStyleAt,
  type CharacterStyleOverride,
  type Fill,
  type SceneNode,
  type StyleRun
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { weightToStyleName } from '#core/figma-api/fonts'

/** The fields `getStyledTextSegments` takes, in the order Figma lists them. */
export const TEXT_SEGMENT_FIELDS = [
  'fontSize',
  'fontName',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationSkipInk',
  'textDecorationOffset',
  'textDecorationThickness',
  'textDecorationColor',
  'textCase',
  'lineHeight',
  'letterSpacing',
  'fills',
  'textStyleId',
  'fillStyleId',
  'listOptions',
  'indentation',
  'hyperlink',
  'openTypeFeatures',
  'boundVariables',
  'textStyleOverrides',
  'paragraphSpacing',
  'listSpacing',
  'paragraphIndent',
  'textWrapStyle'
] as const

export type TextSegmentField = (typeof TEXT_SEGMENT_FIELDS)[number]

/** A size Figma reads as automatic or in pixels; the node keeps pixels. */
export type FigmaTextLength = { unit: 'AUTO' } | { unit: 'PIXELS' | 'PERCENT'; value: number }

/** A character's style: the text's own, with its run's overrides over it. */
type CharacterStyle = Required<
  Pick<
    CharacterStyleOverride,
    | 'fontFamily'
    | 'fontWeight'
    | 'italic'
    | 'fontSize'
    | 'letterSpacing'
    | 'fills'
    | 'textDecoration'
    | 'textDecorationStyle'
    | 'textDecorationFills'
    | 'textDecorationSkipInk'
    | 'fontFeatures'
  >
> & {
  lineHeight: number | null
  textDecorationThickness: number | null
  textUnderlineOffset: number | null
}

export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number]

const TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'fills',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'fontFeatures'
] as const satisfies readonly (keyof CharacterStyle)[]

function nodeStyle(node: SceneNode): CharacterStyle {
  return {
    fontFamily: node.fontFamily,
    fontWeight: node.fontWeight,
    italic: node.italic,
    fontSize: node.fontSize,
    letterSpacing: node.letterSpacing,
    lineHeight: node.lineHeight,
    fills: node.fills,
    textDecoration: node.textDecoration,
    textDecorationStyle: node.textDecorationStyle,
    textDecorationThickness: node.textDecorationThickness,
    textDecorationFills: node.textDecorationFills,
    textDecorationSkipInk: node.textDecorationSkipInk,
    textUnderlineOffset: node.textUnderlineOffset,
    fontFeatures: node.fontFeatures
  }
}

/** Every character's style, from the text's own and the runs over it. */
function characterStyles(node: SceneNode, start: number, end: number): CharacterStyle[] {
  const base = nodeStyle(node)
  const styles = Array.from({ length: end - start }, () => base)
  for (const run of node.styleRuns) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.start + run.length)
    for (let index = from; index < to; index++) {
      styles[index - start] = { ...styles[index - start], ...definedOverrides(run.style) }
    }
  }
  return styles
}

function definedOverrides(style: CharacterStyleOverride): Partial<CharacterStyle> {
  const defined: Partial<Record<keyof CharacterStyle, unknown>> = {}
  for (const key of TEXT_STYLE_KEYS) {
    if (style[key] !== undefined) defined[key] = style[key]
  }
  return defined as Partial<CharacterStyle>
}

function pixels(value: number | null): FigmaTextLength {
  return value === null ? { unit: 'AUTO' } : { unit: 'PIXELS', value }
}

function underlined(style: CharacterStyle): boolean {
  return style.textDecoration === 'UNDERLINE'
}

/** Figma's paint for an underline colour of its own, or automatic, following the text. */
function decorationColor(style: CharacterStyle) {
  const paint = style.textDecorationFills.at(0)
  return paint ? { value: copyFills([paint])[0] } : { value: 'AUTO' as const }
}

function fontFeatureMap(style: CharacterStyle): Record<string, boolean> {
  return Object.fromEntries(style.fontFeatures.map((feature) => [feature.tag, feature.enabled]))
}

type FieldContext = { node: SceneNode; style: CharacterStyle; paragraph: number }

/** The decoration's own style reads null where the text is not underlined. */
function whenUnderlined(read: (style: CharacterStyle) => unknown) {
  return ({ style }: FieldContext) => (underlined(style) ? read(style) : null)
}

function spacing(field: 'paragraphSpacing' | 'listSpacing' | 'paragraphIndent') {
  return ({ node, paragraph }: FieldContext) => paragraphSpacingAt(node, paragraph, field)
}

/**
 * Figma's value of each field for one character. Fields the model keeps for the whole text, such
 * as text case, read the text's value; fields it has no place for read Figma's defaults.
 */
const FIELD_READERS: Record<TextSegmentField, (context: FieldContext) => unknown> = {
  fontSize: ({ style }) => style.fontSize,
  fontName: ({ style }) => ({
    family: style.fontFamily,
    style: weightToStyleName(style.fontWeight, style.italic)
  }),
  fontWeight: ({ style }) => style.fontWeight,
  fontStyle: ({ style }) => (style.italic ? 'ITALIC' : 'REGULAR'),
  textDecoration: ({ style }) => style.textDecoration,
  textDecorationStyle: whenUnderlined((style) => style.textDecorationStyle),
  textDecorationSkipInk: whenUnderlined((style) => style.textDecorationSkipInk),
  textDecorationOffset: whenUnderlined((style) => pixels(style.textUnderlineOffset)),
  textDecorationThickness: whenUnderlined((style) => pixels(style.textDecorationThickness)),
  textDecorationColor: whenUnderlined(decorationColor),
  textCase: ({ node }) => node.textCase,
  lineHeight: ({ style }) => pixels(style.lineHeight),
  letterSpacing: ({ style }) => ({ unit: 'PIXELS', value: style.letterSpacing }),
  fills: ({ style }) => copyFills(style.fills),
  textStyleId: ({ node }) => node.textStyleId ?? '',
  fillStyleId: ({ node }) => node.fillStyleId ?? '',
  listOptions: ({ node, paragraph }) => ({
    type: paragraphStyleAt(node.textParagraphs, paragraph).listType
  }),
  indentation: ({ node, paragraph }) =>
    paragraphStyleAt(node.textParagraphs, paragraph).indentation,
  hyperlink: () => null,
  openTypeFeatures: ({ style }) => fontFeatureMap(style),
  boundVariables: () => ({}),
  textStyleOverrides: () => [],
  paragraphSpacing: spacing('paragraphSpacing'),
  listSpacing: spacing('listSpacing'),
  paragraphIndent: spacing('paragraphIndent'),
  textWrapStyle: () => 'AUTO'
}

function readField(
  node: SceneNode,
  style: CharacterStyle,
  paragraph: number,
  field: TextSegmentField
): unknown {
  return FIELD_READERS[field]({ node, style, paragraph })
}

/** Figma's messages for a range a text method cannot use. */
export function assertTextRange(method: string, node: SceneNode, start: number, end: number) {
  if (start < 0) {
    throw new Error(
      `in ${method}: Property "start" failed validation: Number must be greater than or equal to 0`
    )
  }
  if (end <= start) {
    throw new Error(`in ${method}: Empty range selected. 'end' must be greater than 'start'`)
  }
  if (start >= node.text.length || end > node.text.length) {
    throw new Error(
      `in ${method}: Range outside of available characters. 'start' must be less than ` +
        `node.characters.length and 'end' must be less than or equal to node.characters.length`
    )
  }
}

/** One field's values for `text[start, end)`, character by character. */
function fieldValues(
  node: SceneNode,
  field: TextSegmentField,
  start: number,
  end: number
): unknown[] {
  const styles = characterStyles(node, start, end)
  let paragraph = paragraphIndexAt(node.text, start)
  return styles.map((style, offset) => {
    const value = readField(node, style, paragraph, field)
    // A newline belongs to the paragraph it ends.
    if (node.text[start + offset] === '\n') paragraph++
    return value
  })
}

/** The value every character of the range shares, or `mixed`. */
export function getRangeTextStyle(
  method: string,
  node: SceneNode,
  field: TextSegmentField,
  start: number,
  end: number,
  mixed: symbol
): unknown {
  assertTextRange(method, node, start, end)
  const [first, ...rest] = fieldValues(node, field, start, end)
  return rest.every((value) => isEqual(value, first)) ? first : mixed
}

/** The value every character of the text shares, or `mixed`; empty text reads its own style. */
export function getTextStyle(node: SceneNode, field: TextSegmentField, mixed: symbol): unknown {
  if (node.text.length === 0) return readField(node, nodeStyle(node), 0, field)
  const [first, ...rest] = fieldValues(node, field, 0, node.text.length)
  return rest.every((value) => isEqual(value, first)) ? first : mixed
}

export type StyledTextSegment = {
  characters: string
  start: number
  end: number
} & Partial<Record<TextSegmentField, unknown>>

export function getStyledTextSegments(
  node: SceneNode,
  fields: readonly TextSegmentField[],
  start?: number,
  end?: number
): StyledTextSegment[] {
  const method = 'getStyledTextSegments'
  for (const [index, field] of fields.entries()) {
    if (!(TEXT_SEGMENT_FIELDS as readonly string[]).includes(field)) {
      throw new Error(
        `in ${method}: Property "${method}" failed validation: Invalid enum value. Expected ` +
          `${TEXT_SEGMENT_FIELDS.map((name) => `'${name}'`).join(' | ')}, received '${String(field)}' at index ${index}`
      )
    }
  }
  if ((start === undefined) !== (end === undefined)) {
    throw new Error(`in ${method}: Invalid range. Must provide both 'start' and 'end'`)
  }
  const from = start ?? 0
  const to = end ?? node.text.length
  if (start !== undefined) assertTextRange(method, node, from, to)
  if (to === from) return []

  const ordered = TEXT_SEGMENT_FIELDS.filter((field) => fields.includes(field))
  const columns = ordered.map((field) => fieldValues(node, field, from, to))
  const segments: StyledTextSegment[] = []
  let first = 0
  for (const last of segmentEnds(columns, to - from)) {
    const segment: StyledTextSegment = {
      characters: node.text.slice(from + first, from + last),
      start: from + first,
      end: from + last
    }
    for (const [column, field] of ordered.entries()) segment[field] = columns[column][first]
    segments.push(segment)
    first = last
  }
  return segments
}

/** Where segments end: wherever any requested field changes, and at the end of the range. */
function segmentEnds(columns: readonly unknown[][], length: number): number[] {
  const ends: number[] = []
  let first = 0
  for (let offset = 1; offset < length; offset++) {
    const start = first
    if (columns.some((values) => !isEqual(values[offset], values[start]))) {
      ends.push(offset)
      first = offset
    }
  }
  ends.push(length)
  return ends
}

/** Style runs with no override that only repeats the text's own value. */
function withoutRedundantOverrides(node: SceneNode, runs: StyleRun[]): StyleRun[] {
  const base = nodeStyle(node)
  const result: StyleRun[] = []
  for (const run of runs) {
    const style = omit(
      run.style,
      TEXT_STYLE_KEYS.filter(
        (key) => run.style[key] !== undefined && isEqual(run.style[key], base[key])
      )
    )
    if (Object.keys(style).length === 0) continue
    const previous = result.at(-1)
    if (
      previous &&
      previous.start + previous.length === run.start &&
      isEqual(previous.style, style)
    ) {
      previous.length += run.length
    } else {
      result.push({ start: run.start, length: run.length, style })
    }
  }
  return result
}

/** Style runs with `patch` over `text[start, end)`, as Figma restyles a range. */
export function styleRunsWithPatch(
  node: SceneNode,
  start: number,
  end: number,
  patch: CharacterStyleOverride
): StyleRun[] {
  const length = node.text.length
  const chars: CharacterStyleOverride[] = Array.from({ length }, () => ({}))
  for (const run of node.styleRuns) {
    for (let index = run.start; index < run.start + run.length && index < length; index++) {
      chars[index] = { ...chars[index], ...run.style }
    }
  }
  for (let index = start; index < end; index++) chars[index] = { ...chars[index], ...patch }
  // A newline takes the style of the character before it, as in Figma: a range that ends a
  // paragraph styles its newline too, and a newline cannot be styled on its own.
  for (let index = 1; index < length; index++) {
    if (node.text[index] === '\n') chars[index] = chars[index - 1]
  }
  const runs: StyleRun[] = []
  for (const [index, style] of chars.entries()) {
    const previous = runs.at(-1)
    if (previous && isEqual(previous.style, style)) previous.length++
    else runs.push({ start: index, length: 1, style })
  }
  return withoutRedundantOverrides(
    node,
    runs.filter((run) => Object.keys(run.style).length > 0)
  )
}

/**
 * The change that sets a style for the whole text, as Figma's node setters do: the text takes
 * the value and no range keeps one of its own.
 */
export function textStyleChanges(
  node: SceneNode,
  changes: Partial<Pick<SceneNode, TextStyleKey>>
): Partial<SceneNode> {
  const keys = Object.keys(changes) as TextStyleKey[]
  const runs = node.styleRuns.map((run) => ({ ...run, style: omit(run.style, keys) }))
  return { ...changes, styleRuns: withoutRedundantOverrides({ ...node, ...changes }, runs) }
}

/** Whether any character of the range is underlined, which Figma's decoration setters need. */
export function rangeHasUnderline(node: SceneNode, start: number, end: number): boolean {
  return characterStyles(node, start, end).some(underlined)
}

export type FigmaDecorationColor = { value: 'AUTO' } | { value: Fill }
