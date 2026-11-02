import { uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import {
  canDrawPlatformEmoji,
  mayHoldEmoji,
  NOTO_COLOR_EMOJI_FAMILY,
  savedEmojiCharacters
} from '#core/text/emoji'
import { fontGlyphCoverageSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'
import { collectGraphFontRequirements, collectNodeFontFaces } from '#core/text/requirements/collect'
import { missingGraphFontScripts } from '#core/text/requirements/resolved'

import { documentFontStatus, type DocumentFontStatus } from './font/status'

/**
 * The characters of a text its layout falls back to the emoji metrics font for: ones that may be
 * emoji and that none of the faces it draws in, nor the fallbacks after them, has. A face not
 * loaded cannot tell, and leaves the character to it.
 */
function laidOutEmojiCharacters(node: SceneNode): string {
  if (node.type !== 'TEXT' || !mayHoldEmoji(node.text)) return ''
  const faces = [
    ...collectNodeFontFaces(node),
    { family: DEFAULT_FONT_FAMILY, style: 'Regular' },
    ...[...fontManager.getArabicFallbackFamilies(), ...fontManager.getCJKFallbackFamilies()].map(
      (family) => ({ family, style: 'Regular' })
    )
  ]
  let characters = ''
  for (const character of node.text) {
    if (!mayHoldEmoji(character)) continue
    const drawnByText = faces.some(
      ({ family, style }) => fontGlyphCoverageSync(family, style, character) !== 'missing'
    )
    if (!drawnByText) characters += character
  }
  return characters
}

export async function prepareGraphFonts(
  graph: SceneGraph,
  nodeIds: readonly string[],
  /** Characters a writer draws besides the text's own, which the fonts must map too. */
  extraCharacters = ''
): Promise<DocumentFontStatus> {
  const collected = collectGraphFontRequirements(graph, nodeIds)
  const requirements = extraCharacters
    ? {
        ...collected,
        characters: uniq(Array.from(collected.characters + extraCharacters)).join('')
      }
    : collected
  const faces = requirements.nodes.flatMap(collectNodeFontFaces)
  await Promise.all(
    faces.map(({ family, style }) => fontManager.loadFont(family, style, requirements.characters))
  )
  await fontManager.ensureFallbackPack(
    missingGraphFontScripts(requirements),
    requirements.characters
  )
  // Without a platform that draws emoji, emoji are drawn with Noto, loaded for just these: the
  // saved ones, and the ones the layout leaves to the emoji metrics font.
  const emoji =
    requirements.nodes.map(savedEmojiCharacters).join('') +
    requirements.nodes.map(laidOutEmojiCharacters).join('')
  if (emoji && !canDrawPlatformEmoji())
    await fontManager.loadRemoteFont(NOTO_COLOR_EMOJI_FAMILY, 'Regular', emoji)
  return documentFontStatus(graph, nodeIds)
}
