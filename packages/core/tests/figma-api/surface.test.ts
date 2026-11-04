import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api/index'
import { FIGMA_API_HOST_MEMBERS, SERIALIZATION_MEMBERS } from '#core/figma-api/surface'

// `compatibility.ts` checks the declared types; this checks what a script can actually reach,
// including members installed on prototypes, against the names Figma's typings declare.

const TYPINGS = fileURLToPath(import.meta.resolve('@figma/plugin-typings/plugin-api.d.ts'))

/** Member names of Figma's declared types, read with the TypeScript checker. */
function figmaMembers(...typeNames: string[]): Set<string> {
  const program = ts.createProgram([TYPINGS], { noEmit: true, types: [] })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(TYPINGS)
  if (!source) throw new Error('Figma plugin typings are missing')
  const names = new Set<string>()
  const add = (type: ts.Type) => {
    for (const member of type.isUnion() ? type.types : [type]) {
      for (const property of checker.getPropertiesOfType(member)) names.add(property.name)
    }
  }
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) continue
    if (!typeNames.includes(statement.name.text)) continue
    add(checker.getTypeAtLocation(statement.name))
  }
  return names
}

/**
 * What a script reaches on an object, up its prototype chain. TypeScript-private members, named
 * with a leading underscore, are left out: scripts are not meant to touch them.
 */
function reachable(target: object): string[] {
  const names = new Set<string>()
  for (let proto = target; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name)
  }
  return [...names].filter((name) => name !== 'constructor' && !name.startsWith('_'))
}

function beyondFigma(target: object, figma: Set<string>, listed: readonly string[]): string[] {
  return reachable(target).filter((name) => !figma.has(name) && !listed.includes(name))
}

describe('the scripting surface is Figma’s Plugin API', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)

  test('figma has no members beyond the listed host members', () => {
    expect(beyondFigma(figma, figmaMembers('PluginAPI'), FIGMA_API_HOST_MEMBERS)).toEqual([])
  })

  test('nodes have only the members of Figma’s node types', () => {
    const nodeMembers = figmaMembers('SceneNode', 'PageNode', 'DocumentNode')
    const component = figma.createComponent()
    const set = figma.combineAsVariants([component], figma.currentPage)
    const nodes = [
      figma.createFrame(),
      figma.createText(),
      figma.createRectangle(),
      figma.createSection(),
      figma.union([figma.createRectangle(), figma.createEllipse()], figma.currentPage),
      figma.group([figma.createRectangle()], figma.currentPage),
      component.createInstance(),
      component,
      set,
      figma.currentPage,
      figma.root
    ]
    for (const node of nodes)
      expect(beyondFigma(node, nodeMembers, SERIALIZATION_MEMBERS)).toEqual([])
  })

  test('styles have only the members of Figma’s styles', () => {
    // Members live Figma's text styles have (desktop 126) that its typings do not declare yet.
    const untypedTextStyleMembers = [
      'textDecorationStyle',
      'textDecorationOffset',
      'textDecorationThickness',
      'textDecorationColor',
      'textDecorationSkipInk'
    ]
    const styles = [
      [figma.createPaintStyle(), figmaMembers('PaintStyle'), []],
      [figma.createTextStyle(), figmaMembers('TextStyle'), untypedTextStyleMembers],
      [figma.createEffectStyle(), figmaMembers('EffectStyle'), []],
      [figma.createGridStyle(), figmaMembers('GridStyle'), []]
    ] as const
    for (const [style, members, listed] of styles)
      expect(beyondFigma(style, members, listed)).toEqual([])
  })

  test('variables, collections and figma.variables have only Figma’s members', () => {
    const collection = figma.variables.createVariableCollection('Tokens')
    const variable = figma.variables.createVariable('size', collection, 'FLOAT')
    expect(beyondFigma(figma.variables, figmaMembers('VariablesAPI'), [])).toEqual([])
    expect(beyondFigma(variable, figmaMembers('Variable'), SERIALIZATION_MEMBERS)).toEqual([])
    expect(
      beyondFigma(collection, figmaMembers('VariableCollection'), SERIALIZATION_MEMBERS)
    ).toEqual([])
  })
})
