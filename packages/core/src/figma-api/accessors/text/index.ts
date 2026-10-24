import type {
  CharacterStyleOverride,
  HyperlinkTarget,
  SceneNode,
  TextCase,
  TextParagraphSpacingField
} from '@open-pencil/scene-graph'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { styleNameToWeight, type FigmaFontName } from '#core/figma-api/fonts'
import {
  getParagraphSpacing,
  letterSpacingValue,
  lineHeightValue,
  paragraphStylesForCharacters,
  styleRunsForCharacters,
  spacingProblem,
  type FigmaLetterSpacing,
  type FigmaLineHeight
} from '#core/figma-api/text'
import { getTextStyle, type TextSegmentField } from '#core/figma-api/text/style'
import { styleRunsWithPatch, textStyleChanges } from '#core/text/character-style'

import { hyperlinkTarget } from './hyperlink'

/**
 * Getter/setter pair for a spacing Figma keeps at zero or more. It reads `mixed` while paragraphs
 * differ, and setting it changes the text's own value, which paragraphs with theirs keep.
 */
function spacing(internals: NodeProxyInternals, name: TextParagraphSpacingField, mixed: symbol) {
  return {
    get(this: ProxyThis): number | symbol {
      return getParagraphSpacing(raw(this, internals), name, mixed)
    },
    set(this: ProxyThis, value: number) {
      const invalid = spacingProblem(value)
      if (invalid) {
        throw new Error(`in set_${name}: Property "${name}" failed validation: ${invalid}`)
      }
      updateNode(this, internals, { [name]: value })
    }
  }
}

/**
 * Getter/setter pair for a style characters can override: it reads `mixed` while they differ,
 * and setting it gives every character the value, as Figma's node setters do.
 */
function characterStyle<T>(
  internals: NodeProxyInternals,
  field: TextSegmentField,
  mixed: symbol,
  changes: (node: SceneNode, value: T) => Partial<SceneNode>,
  sized?: (value: T) => ((fontSize: number) => CharacterStyleOverride) | undefined
) {
  return {
    get(this: ProxyThis): unknown {
      return getTextStyle(raw(this, internals), field, mixed)
    },
    set(this: ProxyThis, value: T) {
      const node = raw(this, internals)
      updateNode(this, internals, textStyleChanges(node, changes(node, value), sized?.(value)))
    }
  }
}

/** A length given in percent of the font size, which characters of each size resolve. */
function percentOf(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const length = value as { unit?: unknown; value?: unknown }
  return length.unit === 'PERCENT' && typeof length.value === 'number' ? length.value / 100 : null
}

/** Getter/setter pair for a text property stored verbatim on the node. */
function field<Field extends keyof SceneNode>(internals: NodeProxyInternals, name: Field) {
  return {
    get(this: ProxyThis): SceneNode[Field] {
      return raw(this, internals)[name]
    },
    set(this: ProxyThis, value: SceneNode[Field]) {
      updateNode(this, internals, { [name]: value } as Partial<SceneNode>)
    }
  }
}

export function installTextNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  Object.defineProperties(prototype, {
    characters: {
      get(this: ProxyThis): string {
        return raw(this, internals).text
      },
      set(this: ProxyThis, value: string) {
        const textParagraphs = paragraphStylesForCharacters(raw(this, internals), value)
        const styleRuns = styleRunsForCharacters(raw(this, internals), value)
        updateNode(this, internals, { text: value, textParagraphs, styleRuns })
      }
    },
    fontName: characterStyle<FigmaFontName>(internals, 'fontName', mixed, (_node, value) => {
      const { weight, italic } = styleNameToWeight(value.style)
      return { fontFamily: value.family, fontWeight: weight, italic }
    }),
    fontSize: characterStyle<number>(internals, 'fontSize', mixed, (_node, fontSize) => ({
      fontSize
    })),
    textStyleId: characterStyle<string>(internals, 'textStyleId', mixed, (_node, value) => ({
      textStyleId: value || null
    })),
    fontWeight: characterStyle<number>(internals, 'fontWeight', mixed, (_node, fontWeight) => ({
      fontWeight
    })),
    textAlignHorizontal: field(internals, 'textAlignHorizontal'),
    textAlignVertical: field(internals, 'textAlignVertical'),
    textAutoResize: field(internals, 'textAutoResize'),
    // Figma's plugin API reads and writes these as { unit, value }; a bare object stored on the
    // node instead of pixels would leave the text unmeasurable.
    letterSpacing: characterStyle<FigmaLetterSpacing | number>(
      internals,
      'letterSpacing',
      mixed,
      (node, value) => ({ letterSpacing: letterSpacingValue(node, value) }),
      (value) => {
        const percent = percentOf(value)
        return percent === null ? undefined : (fontSize) => ({ letterSpacing: percent * fontSize })
      }
    ),
    lineHeight: characterStyle<FigmaLineHeight | number | null>(
      internals,
      'lineHeight',
      mixed,
      (node, value) => ({ lineHeight: lineHeightValue(node, value) }),
      (value) => {
        const percent = percentOf(value)
        return percent === null ? undefined : (fontSize) => ({ lineHeight: percent * fontSize })
      }
    ),
    textCase: characterStyle<TextCase>(internals, 'textCase', mixed, (_node, textCase) => ({
      textCase
    })),
    hyperlink: {
      get(this: ProxyThis): unknown {
        return getTextStyle(raw(this, internals), 'hyperlink', mixed)
      },
      set(this: ProxyThis, value: HyperlinkTarget | null) {
        const node = raw(this, internals)
        const hyperlink = hyperlinkTarget('set_hyperlink', value, graph(this, internals))
        const styleRuns = styleRunsWithPatch(node, 0, node.text.length, { hyperlink })
        updateNode(this, internals, { styleRuns })
      }
    },
    textDecoration: characterStyle<SceneNode['textDecoration']>(
      internals,
      'textDecoration',
      mixed,
      (_node, textDecoration) => ({ textDecoration })
    ),
    maxLines: field(internals, 'maxLines'),
    listSpacing: spacing(internals, 'listSpacing', mixed),
    paragraphSpacing: spacing(internals, 'paragraphSpacing', mixed),
    paragraphIndent: spacing(internals, 'paragraphIndent', mixed),
    hangingList: field(internals, 'hangingList'),
    textTruncation: field(internals, 'textTruncation'),
    autoRename: field(internals, 'autoRename')
  })
}
