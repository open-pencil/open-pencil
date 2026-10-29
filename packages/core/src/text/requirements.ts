import { uniqBy } from 'es-toolkit/array'

import type { CharacterStyleOverride, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { weightToStyle } from '@open-pencil/scene-graph/font-style'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { shownCharacters } from '#core/text/case'
import type { FontFaceRef } from '#core/text/face'
import { fontFallbackScriptForCharacter, type FontFallbackScript } from '#core/text/fallbacks'

/** The face a text draws in, or the face a style run over it draws in. */
export function textFontFace(node: SceneNode, style: CharacterStyleOverride = {}): FontFaceRef {
  const weight = style.fontWeight ?? (node.fontWeight || 400)
  const italic = style.italic ?? node.italic
  return {
    family: style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY),
    style: weightToStyle(weight, italic),
    weight,
    italic
  }
}

export function collectNodeFontFaces(node: SceneNode): Array<{ family: string; style: string }> {
  if (node.type !== 'TEXT') return []
  const faces = [textFontFace(node), ...node.styleRuns.map((run) => textFontFace(node, run.style))]
  return uniqBy(faces, (face) => `${face.family}\0${face.style}`).map(({ family, style }) => ({
    family,
    style
  }))
}

export function collectGraphFontKeys(
  graph: SceneGraph,
  nodeIds: readonly string[]
): Array<[string, string]> {
  const fontKeys = new Set<string>()
  const collect = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'TEXT') {
      for (const { family, style } of collectNodeFontFaces(node)) {
        fontKeys.add(`${family}\0${style}`)
      }
    }
    for (const childId of node.childIds) collect(childId)
  }
  for (const nodeId of nodeIds) collect(nodeId)
  return Array.from(fontKeys, (key) => key.split('\0') as [string, string])
}

function textLanguageAt(node: SceneNode, index: number): string | null {
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  return run?.style.textLanguage !== undefined ? run.style.textLanguage : node.textLanguage
}

export interface GraphFontRequirements {
  characters: string
  nodes: SceneNode[]
  scripts: FontFallbackScript[]
}

export function collectGraphFontRequirements(
  graph: SceneGraph,
  nodeIds: readonly string[]
): GraphFontRequirements {
  const characters = new Set<string>()
  const nodes: SceneNode[] = []
  const scripts = new Set<FontFallbackScript>()
  const collect = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    nodes.push(node)
    if (node.type === 'TEXT') {
      for (const { character, sourceIndex } of shownCharacters(node)) {
        characters.add(character)
        const script = fontFallbackScriptForCharacter(character, textLanguageAt(node, sourceIndex))
        if (script) scripts.add(script)
      }
    }
    for (const childId of node.childIds) collect(childId)
  }
  for (const nodeId of nodeIds) collect(nodeId)
  return { characters: Array.from(characters).join(''), nodes, scripts: Array.from(scripts) }
}
