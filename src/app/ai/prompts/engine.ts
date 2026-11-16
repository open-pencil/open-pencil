import type { ASTNode, Expression, TemplateEngine, Token, tokenize } from 'knap'

import { appPreferences } from '@/app/settings/preferences/store'

import { PROMPT_DEFINITIONS, type PromptVariables, type TemplatePrompt } from './definitions'

/** Where a problem is in a template, one-based as editors count. */
export interface TemplateProblem {
  message: string
  line: number
  column: number
}

/** What is wrong with a template: what stops it rendering, and variables it names in vain. */
export interface TemplateCheck {
  errors: TemplateProblem[]
  unknownVariables: TemplateProblem[]
}

/** A filter a template can pipe a value through, with how it is written when Knap shows one. */
export interface PromptFilter {
  name: string
  example?: string
}

interface PromptKnap {
  engine: TemplateEngine
  filters: PromptFilter[]
  tokenize: typeof tokenize
}

let knap: Promise<PromptKnap> | null = null

/** Knap, loaded with the first prompt it fills or the first editor that asks; cached after. */
function loadKnap(): Promise<PromptKnap> {
  return (knap ??= import('knap')
    .then(({ createEngine, standardFilters, standardFilterMetadata, tokenize }) => {
      const engine = createEngine({ filters: standardFilters })
      const filters = Object.keys(engine.filters)
        .sort()
        .map((name) => ({ name, example: standardFilterMetadata[name]?.example }))
      return { engine, filters, tokenize }
    })
    .catch((error: unknown) => {
      // A failed load, such as the chunk not arriving offline, is tried again next time.
      knap = null
      throw error
    }))
}

/** The engine that fills prompts. */
export async function loadPromptEngine(): Promise<TemplateEngine> {
  return (await loadKnap()).engine
}

/** The filters prompts can use, by name. */
export async function loadPromptFilters(): Promise<PromptFilter[]> {
  return (await loadKnap()).filters
}

/** Tags leave the lines they stood on; at most one blank line stays between paragraphs. */
function tidy(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * The prompt `id`, filled with `variables`: the person's own template when they wrote one, else
 * OpenPencil's. A template of theirs that cannot render gives way to OpenPencil's, so a mistake
 * in Settings never stops the work it is for.
 */
export async function renderPrompt<Id extends TemplatePrompt>(
  id: Id,
  variables: PromptVariables<Id>
): Promise<string> {
  const engine = await loadPromptEngine()
  const builtIn = PROMPT_DEFINITIONS[id].template
  const custom = appPreferences.value.prompts[id]
  if (custom !== null) {
    // Knap writes a template's `{% set %}` into the variables it is given, so each render gets
    // its own copy and the built-in prompt is filled from the values as they came.
    const result = await engine.render(custom, { variables: { ...variables } })
    if (result.errors.length === 0) return tidy(result.output)
    console.warn(`[Prompts] The ${id} prompt in Settings does not render; using the built-in one.`)
  }
  return tidy(await engine.renderOrThrow(builtIn, { variables: { ...variables } }))
}

/** The prompt `id` filled from `template` with the sample values its definition gives. */
export async function previewPrompt(id: TemplatePrompt, template: string): Promise<string> {
  const engine = await loadPromptEngine()
  const result = await engine.render(template, {
    variables: { ...PROMPT_DEFINITIONS[id].variables }
  })
  return result.errors.length === 0 ? tidy(result.output) : ''
}

/** The variables an expression reads, where each is read. */
function expressionNames(expression: Expression): TemplateProblem[] {
  switch (expression.type) {
    case 'identifier': {
      // A dotted name reads its first part: `page.name` reads `page`.
      const [name] = expression.path ?? expression.name.split('.')
      return [{ message: name, line: expression.line, column: expression.column }]
    }
    case 'binary':
      return [...expressionNames(expression.left), ...expressionNames(expression.right)]
    case 'unary':
      return expressionNames(expression.argument)
    case 'filter':
      return [expression.value, ...expression.args].flatMap(expressionNames)
    case 'group':
      return expressionNames(expression.expression)
    case 'member':
      return expression.computed
        ? [...expressionNames(expression.object), ...expressionNames(expression.property)]
        : expressionNames(expression.object)
    default:
      return []
  }
}

/** The names a loop over `iterator` reads: the iterator, and the `loop` and `<iterator>_index` Knap gives it. */
function loopNames(iterator: string): string[] {
  return [iterator, 'loop', `${iterator}_index`]
}

/** The variables `nodes` read that are neither the prompt's nor set by the template itself. */
function unknownNames(nodes: readonly ASTNode[], known: Set<string>): TemplateProblem[] {
  const unknown: TemplateProblem[] = []
  const read = (expression: Expression, bound: Set<string>) => {
    for (const name of expressionNames(expression)) if (!bound.has(name.message)) unknown.push(name)
  }
  const walk = (list: readonly ASTNode[], bound: Set<string>) => {
    for (const node of list) {
      if (node.type === 'variable') read(node.expression, bound)
      else if (node.type === 'set') {
        read(node.value, bound)
        bound.add(node.variable)
      } else if (node.type === 'if') {
        // Each branch sets names for itself; after the `if`, a name is set only when every path
        // sets it, which takes an `else`.
        const paths = [{ condition: node.condition, body: node.consequent }, ...node.elseifs]
        const branches = paths.map(({ condition, body }) => {
          read(condition, bound)
          const branch = new Set(bound)
          walk(body, branch)
          return branch
        })
        if (node.alternate) {
          const otherwise = new Set(bound)
          walk(node.alternate, otherwise)
          for (const name of otherwise)
            if (branches.every((branch) => branch.has(name))) bound.add(name)
        }
      } else if (node.type === 'for') {
        read(node.iterable, bound)
        walk(node.body, new Set([...bound, ...loopNames(node.iterator)]))
      }
    }
  }
  walk(nodes, new Set(known))
  return unknown
}

/** What is wrong with `template` as the prompt `id`. */
export async function checkTemplate(id: TemplatePrompt, template: string): Promise<TemplateCheck> {
  const engine = await loadPromptEngine()
  const errors = engine.validate(template).map(({ message, line, column }) => ({
    message,
    line,
    column
  }))
  if (errors.length > 0) return { errors, unknownVariables: [] }
  // A template can parse and still fail on its values, such as a loop over text, so it is
  // filled with the sample values too.
  const filled = await engine.render(template, {
    variables: { ...PROMPT_DEFINITIONS[id].variables }
  })
  if (filled.errors.length > 0) {
    return {
      errors: filled.errors.map(({ message, line, column }) => ({ message, line, column })),
      unknownVariables: []
    }
  }
  const known = new Set(Object.keys(PROMPT_DEFINITIONS[id].variables))
  return { errors, unknownVariables: unknownNames(engine.parse(template).ast, known) }
}

/** Knap's tags, the words a template writes right after `{%`. */
export const TEMPLATE_TAGS = ['if', 'elseif', 'else', 'endif', 'for', 'endfor', 'set'] as const

/** What a template takes where some text of it ends, as Knap reads that text. */
export interface TemplatePlace {
  /** A tag's name after `{%`, a filter's after `|`, else a variable's. */
  kind: 'tag' | 'filter' | 'variable'
  /** Where the name being written starts in the text, and what of it is written. */
  from: number
  word: string
  /** The names the text sets itself, and the iterators of loops still open where it ends. */
  defined: string[]
}

/** The tokens that open or close an expression, and the text outside them. */
const DELIMITERS = new Set<Token['type']>([
  'variable_start',
  'variable_end',
  'tag_start',
  'tag_end',
  'text'
])

/** Where a token starts in `text`, from Knap's one-based line and column. */
function tokenOffset(text: string, { line, column }: Token): number {
  let offset = 0
  for (let at = 1; at < line; at++) offset = text.indexOf('\n', offset) + 1
  return offset + column - 1
}

/** The names `tokens` define: what `set` assigns, and the iterators of loops not yet ended. */
function definedNames(tokens: readonly Token[]): string[] {
  const set: string[] = []
  const loops: string[][] = []
  tokens.forEach((token, index) => {
    const name = tokens.at(index + 1)
    if (token.type === 'keyword_endfor') loops.pop()
    if (name?.type !== 'identifier') return
    if (token.type === 'keyword_set') set.push(name.value)
    if (token.type === 'keyword_for') loops.push(loopNames(name.value))
  })
  return [...set, ...loops.flat()]
}

/**
 * What can be written where `before`, a template's text up to the cursor, ends, read with
 * Knap's own tokenizer: nothing in plain text, a string, a property after `.`, or the new name
 * `for` and `set` take.
 */
export async function templatePlace(before: string): Promise<TemplatePlace | null> {
  const { tokenize } = await loadKnap()
  const tokens = tokenize(before).tokens.filter((token) => token.type !== 'eof')
  const last = tokens.at(-1)
  if (!last || last.type === 'string') return null
  const lastFrom = tokenOffset(before, last)
  const typing = last.type === 'identifier' && lastFrom + last.value.length === before.length
  const previous = typing ? tokens.at(-2) : last
  const opened = tokens.findLast((token) => DELIMITERS.has(token.type))
  if (!previous || (opened?.type !== 'variable_start' && opened?.type !== 'tag_start')) return null
  const from = typing ? lastFrom : before.length
  const word = typing ? last.value : ''
  // Knap reads `page.name` as one name; prompts' variables have no properties to offer.
  if (word.includes('.')) return null
  const defined = definedNames(tokens)
  switch (previous.type) {
    case 'tag_start':
      return { kind: 'tag', from, word, defined }
    case 'pipe':
      return { kind: 'filter', from, word, defined }
    case 'string':
    case 'keyword_for':
    case 'keyword_set':
      return null
    default:
      return { kind: 'variable', from, word, defined }
  }
}
