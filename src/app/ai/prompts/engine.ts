import type { ASTNode, Expression, TemplateEngine } from 'knap'

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

let engine: Promise<TemplateEngine> | null = null

/** Knap, loaded with the first prompt it fills; the module is cached after. */
export function loadPromptEngine(): Promise<TemplateEngine> {
  return (engine ??= import('knap').then(({ createEngine, standardFilters }) =>
    createEngine({ filters: standardFilters })
  ))
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
export async function renderPrompt(
  id: TemplatePrompt,
  variables: PromptVariables
): Promise<string> {
  const knap = await loadPromptEngine()
  const builtIn = PROMPT_DEFINITIONS[id].template
  const custom = appPreferences.value.prompts[id]
  if (custom !== null) {
    // Knap writes a template's `{% set %}` into the variables it is given, so each render gets
    // its own copy and the built-in prompt is filled from the values as they came.
    const result = await knap.render(custom, { variables: { ...variables } })
    if (result.errors.length === 0) return tidy(result.output)
    console.warn(`[Prompts] The ${id} prompt in Settings does not render; using the built-in one.`)
  }
  return tidy(await knap.renderOrThrow(builtIn, { variables: { ...variables } }))
}

/** The prompt `id` filled from `template` with the sample values its definition gives. */
export async function previewPrompt(id: TemplatePrompt, template: string): Promise<string> {
  const knap = await loadPromptEngine()
  const result = await knap.render(template, {
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
        read(node.condition, bound)
        walk(node.consequent, bound)
        for (const branch of node.elseifs) {
          read(branch.condition, bound)
          walk(branch.body, bound)
        }
        if (node.alternate) walk(node.alternate, bound)
      } else if (node.type === 'for') {
        read(node.iterable, bound)
        // Knap gives each loop `loop` and `<iterator>_index` besides the iterator itself.
        walk(node.body, new Set([...bound, node.iterator, 'loop', `${node.iterator}_index`]))
      }
    }
  }
  walk(nodes, new Set(known))
  return unknown
}

/** What is wrong with `template` as the prompt `id`. */
export async function checkTemplate(id: TemplatePrompt, template: string): Promise<TemplateCheck> {
  const knap = await loadPromptEngine()
  const errors = knap.validate(template).map(({ message, line, column }) => ({
    message,
    line,
    column
  }))
  if (errors.length > 0) return { errors, unknownVariables: [] }
  // A template can parse and still fail on its values, such as a loop over text, so it is
  // filled with the sample values too.
  const filled = await knap.render(template, {
    variables: { ...PROMPT_DEFINITIONS[id].variables }
  })
  if (filled.errors.length > 0) {
    return {
      errors: filled.errors.map(({ message, line, column }) => ({ message, line, column })),
      unknownVariables: []
    }
  }
  const known = new Set(Object.keys(PROMPT_DEFINITIONS[id].variables))
  return { errors, unknownVariables: unknownNames(knap.parse(template).ast, known) }
}
