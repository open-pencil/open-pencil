import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import {
  ARABIC_CHARACTER,
  CJK_CHARACTER,
  cjkFallbackScriptForLanguage,
  fontFallbackScriptForCharacter,
  HAN_CHARACTER,
  HANGUL_CHARACTER,
  KANA_CHARACTER,
  isTraditionalOnlyHan,
  type FontFallbackScript
} from '#core/text/fallbacks'
import { fontGlyphCoverageSync } from '#core/text/font/glyphs'
import { textFontFace } from '#core/text/requirements/collect'

function scriptCharacterTest(script: FontFallbackScript): (character: string) => boolean {
  switch (script) {
    case 'arabic':
      return (character) => ARABIC_CHARACTER.test(character)
    case 'cjk-jp':
      return (character) => KANA_CHARACTER.test(character)
    case 'cjk-kr':
      return (character) => HANGUL_CHARACTER.test(character)
    case 'cjk-tc':
      return isTraditionalOnlyHan
    default:
      return (character) => HAN_CHARACTER.test(character)
  }
}

export function textHasFallbackScript(text: string): boolean {
  return ARABIC_CHARACTER.test(text) || CJK_CHARACTER.test(text)
}

function styleForCharacter(
  node: SceneNode,
  index: number
): { family: string; style: string; language: string | null } {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  let family = baseFamily
  let language = node.textLanguage

  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  if (run) {
    family = run.style.fontFamily ?? family
    if (run.style.textLanguage !== undefined) language = run.style.textLanguage
  }

  return { family, style: textFontFace(node, run?.style).style, language }
}

/**
 * Returns true only when a loaded, parseable primary font is known to miss a script glyph.
 * Unknown coverage is treated as renderable so we do not degrade fonts CanvasKit may handle.
 */
export function textNeedsFallbackScript(node: SceneNode, script: FontFallbackScript): boolean {
  if (node.type !== 'TEXT' || !node.text) return false
  const inScript = scriptCharacterTest(script)

  let index = 0
  for (const char of node.text) {
    if (inScript(char)) {
      const { family, style } = styleForCharacter(node, index)
      if (fontGlyphCoverageSync(family, style, char) === 'missing') return true
    }
    index += char.length
  }

  return false
}

export function textFallbackScriptsWithoutCoverage(node: SceneNode): FontFallbackScript[] {
  if (node.type !== 'TEXT') return []
  const scripts = new Set<FontFallbackScript>()
  let index = 0
  for (const char of node.text) {
    const { language } = styleForCharacter(node, index)
    const script = fontFallbackScriptForCharacter(char, language)
    if (script) scripts.add(script)
    index += char.length
  }
  return [...scripts]
}

export function textNeededFallbackScripts(node: SceneNode): FontFallbackScript[] {
  const scripts = new Set<FontFallbackScript>()
  if (textNeedsFallbackScript(node, 'arabic')) scripts.add('arabic')

  let missingIdeograph = false
  let missingTraditionalIdeograph = false
  let index = 0
  for (const char of node.text) {
    if (CJK_CHARACTER.test(char)) {
      const { family, style, language } = styleForCharacter(node, index)
      if (fontGlyphCoverageSync(family, style, char) === 'missing') {
        if (HAN_CHARACTER.test(char)) {
          const languageScript = cjkFallbackScriptForLanguage(language)
          if (languageScript) scripts.add(languageScript)
          else {
            missingIdeograph = true
            if (isTraditionalOnlyHan(char)) missingTraditionalIdeograph = true
          }
        } else {
          const script = fontFallbackScriptForCharacter(char, language)
          if (script) scripts.add(script)
        }
      }
    }
    index += char.length
  }

  if (missingIdeograph) scripts.add(missingTraditionalIdeograph ? 'cjk-tc' : 'cjk-sc')

  return [...scripts]
}
