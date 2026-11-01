import { omit, pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import {
  TEXT_BINDABLE_FIELDS,
  type CharacterStyleOverride,
  type HyperlinkTarget,
  type SceneNode,
  type StyleRun,
  type TextBoundVariables,
  type TextLength
} from '@open-pencil/scene-graph'
import {
  FACE_KEYS,
  rangeFontStyle,
  SHARED_TEXT_STYLE_FIELDS,
  styleDetachmentChanges
} from '@open-pencil/scene-graph/shared-styles'

/** A character's style: the text's own, with its run's overrides over it. */
export type CharacterStyle = Required<
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
    | 'fontVariations'
    | 'opticalSizeFromFontSize'
    | 'textCase'
  >
> & {
  fontStyle: string | null
  lineHeight: TextLength | null
  textDecorationThickness: number | null
  textUnderlineOffset: number | null
  hyperlink: HyperlinkTarget | null
  textStyleId: string | null
  fillStyleId: string | null
  boundVariables: TextBoundVariables
}

export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number]

export const TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'fontStyle',
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
  'fontFeatures',
  'fontVariations',
  'opticalSizeFromFontSize',
  'textCase'
] as const satisfies readonly (keyof CharacterStyle)[]

/**
 * What a range of characters can hold that is not a style of the text's own: a link, the
 * styles it uses, and its bindings. The text's styles and bindings are what ranges start from.
 */
const RANGE_STYLE_KEYS = ['hyperlink', 'textStyleId', 'fillStyleId', 'boundVariables'] as const

/** Every field a character's style has, as runs override it. */
export const CHARACTER_STYLE_KEYS = [
  ...TEXT_STYLE_KEYS,
  ...RANGE_STYLE_KEYS
] as const satisfies readonly (keyof CharacterStyle)[]

export function nodeStyle(node: SceneNode): CharacterStyle {
  return {
    fontFamily: node.fontFamily,
    fontWeight: node.fontWeight,
    italic: node.italic,
    fontStyle: node.fontStyle,
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
    fontFeatures: node.fontFeatures,
    fontVariations: node.fontVariations,
    opticalSizeFromFontSize: node.opticalSizeFromFontSize,
    textCase: node.textCase,
    hyperlink: null,
    textStyleId: node.textStyleId,
    fillStyleId: node.fillStyleId,
    boundVariables: pick(node.boundVariables, TEXT_BINDABLE_FIELDS)
  }
}

/** Every character's style, from the text's own and the runs over it. */
export function characterStyles(node: SceneNode, start: number, end: number): CharacterStyle[] {
  const base = nodeStyle(node)
  const styles = Array.from({ length: end - start }, () => base)
  for (const run of node.styleRuns) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.start + run.length)
    for (let index = from; index < to; index++) {
      styles[index - start] = {
        ...styles[index - start],
        ...definedOverrides(run.style),
        fontStyle: rangeFontStyle(node, run.style)
      }
    }
  }
  return styles
}

function definedOverrides(style: CharacterStyleOverride): Partial<CharacterStyle> {
  const defined: Partial<Record<keyof CharacterStyle, unknown>> = {}
  for (const key of CHARACTER_STYLE_KEYS) {
    if (style[key] !== undefined) defined[key] = style[key]
  }
  return defined as Partial<CharacterStyle>
}

/** Style runs with no override that only repeats the text's own value. */
function withoutRedundantOverrides(node: SceneNode, runs: StyleRun[]): StyleRun[] {
  const base = nodeStyle(node)
  const result: StyleRun[] = []
  for (const run of runs) {
    const style = omit(
      run.style,
      CHARACTER_STYLE_KEYS.filter(
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

/**
 * A style for a range, or one per font size for a length given in percent of the font size,
 * which characters of each size resolve to their own length.
 */
export type TextStylePatch = CharacterStyleOverride | ((fontSize: number) => CharacterStyleOverride)

/**
 * The styles characters leave when `style` changes what a style gave them, as a text leaves its
 * own: a font size leaves the text style, and fills leave the fill style.
 */
function detachedStyles(
  node: SceneNode,
  current: CharacterStyleOverride,
  style: CharacterStyleOverride | undefined
): CharacterStyleOverride {
  if (!style) return {}
  const styled = { ...node, ...current }
  const changes = pick(style, [...TEXT_STYLE_KEYS, 'fills', 'textStyleId', 'fillStyleId'])
  const detached = styleDetachmentChanges(styled, changes)
  return pick(
    detached,
    (['textStyleId', 'fillStyleId', 'fontStyle'] as const).filter(
      (key) => !Object.hasOwn(changes, key) && Object.hasOwn(detached, key)
    )
  )
}

/** Style runs with `patch` over `text[start, end)`, as Figma restyles a range. */
export function styleRunsWithPatch(
  node: SceneNode,
  start: number,
  end: number,
  patch: TextStylePatch
): StyleRun[] {
  const length = node.text.length
  const chars: CharacterStyleOverride[] = Array.from({ length }, () => ({}))
  for (const run of node.styleRuns) {
    for (let index = run.start; index < run.start + run.length && index < length; index++) {
      chars[index] = { ...chars[index], ...run.style }
    }
  }
  const sized = typeof patch === 'function' ? patch : null
  const patches = new Map<number, CharacterStyleOverride>()
  for (let index = start; index < end; index++) {
    let style = sized ? undefined : (patch as CharacterStyleOverride)
    if (sized) {
      const fontSize = chars[index].fontSize ?? node.fontSize
      style = patches.get(fontSize) ?? sized(fontSize)
      patches.set(fontSize, style)
    }
    chars[index] = { ...chars[index], ...style, ...detachedStyles(node, chars[index], style) }
  }
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
  changes: Partial<Pick<SceneNode, TextStyleKey | 'textStyleId' | 'fillStyleId'>>,
  sized?: (fontSize: number) => CharacterStyleOverride
): Partial<SceneNode> {
  const changed = Object.keys(changes) as (keyof CharacterStyleOverride)[]
  // A style a range keeps no longer gives it what the whole text now sets.
  const keys = [
    ...changed,
    ...(changed.some((key) => (SHARED_TEXT_STYLE_FIELDS as readonly string[]).includes(key))
      ? (['textStyleId'] as const)
      : []),
    ...(changed.includes('fills') ? (['fillStyleId'] as const) : []),
    // A range's face name names none once the text's face changes under it.
    ...(changed.some((key) => (FACE_KEYS as readonly string[]).includes(key))
      ? (['fontStyle'] as const)
      : [])
  ]
  const runs = node.styleRuns.map((run) => ({ ...run, style: omit(run.style, keys) }))
  const updated = { ...node, ...changes }
  const styleRuns = withoutRedundantOverrides(updated, runs)
  // A percent gives characters of another size their own length.
  if (!sized) return { ...changes, styleRuns }
  return {
    ...changes,
    styleRuns: styleRunsWithPatch({ ...updated, styleRuns }, 0, node.text.length, sized)
  }
}
