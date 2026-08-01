import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { transformTextCase } from '#core/text/case'
import { cjkFallbackScriptForLanguage, type FontFallbackScript } from '#core/text/fallbacks'
import { weightToStyle } from '#core/text/font-style'

export type TextNodeFontSource = Pick<
  SceneNode,
  'fontFamily' | 'fontWeight' | 'italic' | 'styleRuns'
>

/** Distinct family|style pairs used by one TEXT node (base + style runs). */
export function collectNodeFontKeys(node: TextNodeFontSource): Array<[string, string]> {
  const fontKeys = new Set<string>()
  addNodeFontKeys(fontKeys, node)
  return Array.from(fontKeys, (key) => key.split('\0') as [string, string])
}

function addNodeFontKeys(fontKeys: Set<string>, node: TextNodeFontSource): void {
  const family = node.fontFamily || DEFAULT_FONT_FAMILY
  fontKeys.add(`${family}\0${weightToStyle(node.fontWeight || 400, node.italic)}`)
  for (const run of node.styleRuns) {
    const runFamily = run.style.fontFamily ?? family
    const weight = run.style.fontWeight ?? node.fontWeight
    const italic = run.style.italic ?? node.italic
    fontKeys.add(`${runFamily}\0${weightToStyle(weight, italic)}`)
  }
}

export function collectGraphFontKeys(
  graph: SceneGraph,
  nodeIds: readonly string[]
): Array<[string, string]> {
  const fontKeys = new Set<string>()
  const collect = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'TEXT') addNodeFontKeys(fontKeys, node)
    for (const childId of node.childIds) collect(childId)
  }
  for (const nodeId of nodeIds) collect(nodeId)
  return Array.from(fontKeys, (key) => key.split('\0') as [string, string])
}

function fallbackScriptForCharacter(
  character: string,
  language?: string | null
): FontFallbackScript | null {
  if (/\p{Script=Arabic}/u.test(character)) return 'arabic'
  if (/\p{Script=Hangul}/u.test(character)) return 'cjk-kr'
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)) return 'cjk-jp'
  if (/\p{Script=Han}/u.test(character)) return cjkFallbackScriptForLanguage(language) ?? 'cjk-sc'
  return null
}

function textLanguageAt(node: SceneNode, index: number): string | null {
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  return run?.style.textLanguage ?? node.textLanguage
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
      let index = 0
      for (const character of transformTextCase(node.text, node.textCase)) {
        characters.add(character)
        const script = fallbackScriptForCharacter(character, textLanguageAt(node, index))
        if (script) scripts.add(script)
        index += character.length
      }
    }
    for (const childId of node.childIds) collect(childId)
  }
  for (const nodeId of nodeIds) collect(nodeId)
  return { characters: Array.from(characters).join(''), nodes, scripts: Array.from(scripts) }
}
