import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { transformTextCase } from '#core/text/case'
import { cjkFallbackScriptForLanguage, type FontFallbackScript } from '#core/text/fallbacks'
import { weightToStyle } from '#core/text/font/style'

export function collectNodeFontFaces(node: SceneNode): Array<{ family: string; style: string }> {
  if (node.type !== 'TEXT') return []
  const family = node.fontFamily || DEFAULT_FONT_FAMILY
  const faces = new Map<string, { family: string; style: string }>()
  const add = (faceFamily: string, style: string) => {
    faces.set(`${faceFamily}\0${style}`, { family: faceFamily, style })
  }
  add(family, weightToStyle(node.fontWeight || 400, node.italic))
  for (const run of node.styleRuns) {
    const runFamily = run.style.fontFamily ?? family
    const weight = run.style.fontWeight ?? node.fontWeight
    const italic = run.style.italic ?? node.italic
    add(runFamily, weightToStyle(weight, italic))
  }
  return [...faces.values()]
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

function transformedCharactersWithSourceOffsets(
  node: SceneNode
): Array<{ character: string; sourceIndex: number }> {
  const result: Array<{ character: string; sourceIndex: number }> = []
  let sourceIndex = 0
  for (const sourceCharacter of node.text) {
    for (const character of transformTextCase(sourceCharacter, node.textCase)) {
      result.push({ character, sourceIndex })
    }
    sourceIndex += sourceCharacter.length
  }
  return result
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
      for (const { character, sourceIndex } of transformedCharactersWithSourceOffsets(node)) {
        characters.add(character)
        const script = fallbackScriptForCharacter(character, textLanguageAt(node, sourceIndex))
        if (script) scripts.add(script)
      }
    }
    for (const childId of node.childIds) collect(childId)
  }
  for (const nodeId of nodeIds) collect(nodeId)
  return { characters: Array.from(characters).join(''), nodes, scripts: Array.from(scripts) }
}
