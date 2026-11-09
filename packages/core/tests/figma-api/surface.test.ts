import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api/index'
import { FIGMA_API_HOST_MEMBERS, SERIALIZATION_MEMBERS } from '#core/figma-api/surface'
import { compileScript } from '#core/tools/analyze/eval/wrap'

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

const BUILT_IN_PROTOTYPES = new Set<object | null>([
  null,
  Object.prototype,
  Function.prototype,
  Array.prototype,
  Map.prototype,
  Set.prototype
])

/**
 * Every object a script reaches from `roots` in a few steps, with the first path to it: through
 * string and symbol keys, own and inherited, reading getters, and calling symbol-keyed and
 * underscored methods, which no Figma type has.
 */
function reachableObjects(roots: object, depth = 4): Map<unknown, string> {
  const reached = new Map<unknown, string>()
  let frontier = Object.entries(roots).map(([path, value]): [unknown, string] => [value, path])
  for (let step = 0; step <= depth && frontier.length > 0; step++) {
    const next: [unknown, string][] = []
    for (const [value, path] of frontier) {
      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) continue
      if (reached.has(value)) continue
      reached.set(value, path)
      for (const [key, member] of members(value)) {
        const name = typeof key === 'symbol' ? `[${key.description}]` : key
        next.push([member, `${path}.${name}`])
        if ((typeof key === 'symbol' || key.startsWith('_')) && typeof member === 'function')
          next.push([attempt(() => Reflect.apply(member, value, [])), `${path}.${name}()`])
      }
      if (value instanceof Map || value instanceof Set || Array.isArray(value))
        for (const [index, item] of [...value.values()].entries()) next.push([item, `${path}[${index}]`])
    }
    frontier = next
  }
  return reached
}

function members(value: object): [string | symbol, unknown][] {
  const found: [string | symbol, unknown][] = []
  for (let owner: object | null = value; !BUILT_IN_PROTOTYPES.has(owner); owner = Object.getPrototypeOf(owner) as object | null)
    if (owner) for (const key of Reflect.ownKeys(owner)) found.push([key, attempt(() => Reflect.get(value, key))])
  return found
}

function attempt(read: () => unknown): unknown {
  try {
    return read()
  } catch {
    return undefined
  }
}

describe('the scripting surface is Figma’s Plugin API', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)

  test('figma has no members beyond the listed host members', () => {
    expect(beyondFigma(figma, figmaMembers('PluginAPI'), FIGMA_API_HOST_MEMBERS)).toEqual([])
  })

  test('a script reaches no scene graph or raw layer from figma, openpencil, or a node', async () => {
    const component = figma.createComponent()
    const style = figma.createPaintStyle()
    const collection = figma.variables.createVariableCollection('Tokens')
    const roots = await compileScript(`return {
      figma,
      openpencil,
      page: figma.currentPage,
      root: figma.root,
      frame: figma.createFrame(),
      text: figma.createText(),
      instance: figma.getNodeById(${JSON.stringify(component.id)}).createInstance(),
      style: figma.getStyleById(${JSON.stringify(style.id)}),
      collection: figma.variables.getVariableCollectionById(${JSON.stringify(collection.id)}),
      variable: figma.variables.createVariable('gap', ${JSON.stringify(collection.id)}, 'FLOAT')
    }`)(figma)
    if (typeof roots !== 'object' || roots === null) throw new Error('the script returned no roots')
    const reached = reachableObjects(roots)
    const layers = new Set<unknown>(graph.getAllNodes())
    expect(
      [...reached].filter(([value]) => value instanceof SceneGraph || layers.has(value)).map(([, path]) => path)
    ).toEqual([])
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
