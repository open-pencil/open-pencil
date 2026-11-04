import type {
  HyperlinkTarget,
  LeadingTrim,
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
import { assertFontLoaded, assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import type { FigmaFontNameInput } from '#core/figma-api/fonts/names'
import { atLeast } from '#core/figma-api/schema'
import {
  getParagraphSpacing,
  letterSpacingValue,
  lineHeightValue,
  paragraphStylesForCharacters,
  styleRunsForCharacters,
  type FigmaLetterSpacing,
  type FigmaLineHeight
} from '#core/figma-api/text'
import { getTextStyle, type TextSegmentField } from '#core/figma-api/text/style'
import { parseFigma } from '#core/figma-api/validation'
import { styleRunsWithPatch, textStyleChanges } from '#core/text/character-style'

import { installTextDecorationAccessors } from './decoration'
import { hyperlinkTarget } from './hyperlink'
import { fontNameStyle } from './ranges'
import { DECORATIONS, enumValue, fontSizeValue, textCaseValue } from './values'

const LEADING_TRIMS = new Set<LeadingTrim>(['CAP_HEIGHT', 'NONE'])

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
      parseFigma(atLeast(0), value, `set_${name}`, name)
      assertTextFontsLoaded(`set_${name}`, raw(this, internals))
      updateNode(this, internals, { [name]: value })
    }
  }
}

/**
 * Getter/setter pair for a style characters can override: it reads `mixed` while they differ,
 * and setting it gives every character the value, as Figma's node setters do. Setting one that
 * lays the text out again needs the text's fonts loaded, as in Figma.
 */
function characterStyle<T>(
  internals: NodeProxyInternals,
  field: TextSegmentField,
  mixed: symbol,
  changes: (node: SceneNode, value: T) => Partial<SceneNode>,
  needsFonts = true
) {
  return {
    get(this: ProxyThis): unknown {
      return getTextStyle(raw(this, internals), field, mixed)
    },
    set(this: ProxyThis, value: T) {
      const node = raw(this, internals)
      const patch = changes(node, value)
      if (needsFonts) assertTextFontsLoaded(`set_${field}`, node)
      updateNode(this, internals, textStyleChanges(node, patch))
    }
  }
}

/**
 * Getter/setter pair for a text property stored verbatim on the node; one that lays the text out
 * again needs its fonts loaded, as in Figma.
 */
function field<Field extends keyof SceneNode>(
  internals: NodeProxyInternals,
  name: Field,
  needsFonts = true
) {
  return {
    get(this: ProxyThis): SceneNode[Field] {
      return raw(this, internals)[name]
    },
    set(this: ProxyThis, value: SceneNode[Field]) {
      if (needsFonts) assertTextFontsLoaded(`set_${name}`, raw(this, internals))
      updateNode(this, internals, { [name]: value })
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
        assertTextFontsLoaded('set_characters', raw(this, internals))
        const textParagraphs = paragraphStylesForCharacters(raw(this, internals), value)
        const styleRuns = styleRunsForCharacters(raw(this, internals), value)
        updateNode(this, internals, { text: value, textParagraphs, styleRuns })
      }
    },
    // The new font replaces every character's, so only it has to be loaded, as in Figma.
    fontName: characterStyle<FigmaFontNameInput>(
      internals,
      'fontName',
      mixed,
      (node, value) => {
        const style = fontNameStyle('set_fontName', node, 0, value, 'fontName')
        assertFontLoaded('set_fontName', node, style)
        return style
      },
      false
    ),
    fontSize: characterStyle<number>(internals, 'fontSize', mixed, (_node, value) => ({
      fontSize: fontSizeValue('set_fontSize', value, 'fontSize')
    })),
    // A weight is a face of its own, which has to be loaded as a new font does.
    fontWeight: characterStyle<number>(internals, 'fontWeight', mixed, (node, fontWeight) => {
      const style = { fontWeight, fontStyle: null }
      assertFontLoaded('set_fontWeight', node, style)
      return style
    }),
    textAlignHorizontal: field(internals, 'textAlignHorizontal'),
    textAlignVertical: field(internals, 'textAlignVertical'),
    textAutoResize: field(internals, 'textAutoResize'),
    // Figma's plugin API reads and writes these as { unit, value }; a bare object stored on the
    // node instead of pixels would leave the text unmeasurable.
    letterSpacing: characterStyle<FigmaLetterSpacing | number>(
      internals,
      'letterSpacing',
      mixed,
      (_node, value) => ({ letterSpacing: letterSpacingValue(value) })
    ),
    lineHeight: characterStyle<FigmaLineHeight | number | null>(
      internals,
      'lineHeight',
      mixed,
      (_node, value) => ({ lineHeight: lineHeightValue(value) })
    ),
    textCase: characterStyle<TextCase>(internals, 'textCase', mixed, (_node, value) => ({
      textCase: textCaseValue('set_textCase', value, 'textCase')
    })),
    hyperlink: {
      get(this: ProxyThis): unknown {
        return getTextStyle(raw(this, internals), 'hyperlink', mixed)
      },
      set(this: ProxyThis, value: HyperlinkTarget | null) {
        const node = raw(this, internals)
        const hyperlink = hyperlinkTarget('set_hyperlink', value, graph(this, internals), 'value')
        const styleRuns = styleRunsWithPatch(node, 0, node.text.length, { hyperlink })
        updateNode(this, internals, { styleRuns })
      }
    },
    textDecoration: characterStyle<SceneNode['textDecoration']>(
      internals,
      'textDecoration',
      mixed,
      (_node, value) => ({
        textDecoration: enumValue('set_textDecoration', value, DECORATIONS, 'textDecoration')
      })
    ),
    maxLines: field(internals, 'maxLines'),
    listSpacing: spacing(internals, 'listSpacing', mixed),
    paragraphSpacing: spacing(internals, 'paragraphSpacing', mixed),
    paragraphIndent: spacing(internals, 'paragraphIndent', mixed),
    hangingList: field(internals, 'hangingList'),
    leadingTrim: {
      get(this: ProxyThis): LeadingTrim {
        return raw(this, internals).leadingTrim
      },
      set(this: ProxyThis, value: unknown) {
        const leadingTrim = enumValue('set_leadingTrim', value, LEADING_TRIMS, 'leadingTrim')
        assertTextFontsLoaded('set_leadingTrim', raw(this, internals))
        updateNode(this, internals, { leadingTrim })
      }
    },
    // Figma reads the features characters set; assigning to it does nothing, as in Figma.
    openTypeFeatures: {
      get(this: ProxyThis): unknown {
        const features = getTextStyle(raw(this, internals), 'openTypeFeatures', mixed)
        return typeof features === 'symbol' ? features : Object.freeze(features)
      },
      set() {
        // Figma ignores the assignment without an error.
      }
    },
    textTruncation: field(internals, 'textTruncation'),
    autoRename: field(internals, 'autoRename', false)
  })
  installTextDecorationAccessors(prototype, internals, mixed)
}
