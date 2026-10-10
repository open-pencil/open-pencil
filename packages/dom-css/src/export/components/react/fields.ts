import dedent from 'dedent'

import { es, jsx } from '@open-pencil/emit'

import { progressWidth } from '../fields'
import type { ComponentElement, ComponentModel, GeneratedKind } from '../model'
import { moduleClass, numeric, type MarkupUses } from './shared'

/** Kinds whose native input takes the caller's props, rather than their root. */
export const INPUT_PROPS: Partial<Record<GeneratedKind, 'input' | 'textarea'>> = {
  textField: 'input',
  textarea: 'textarea'
}

/** A number field's stepper parts, which change its value by a step. */
export const STEPPERS: Record<string, { label: string; sign: '+' | '-' }> = {
  increment: { label: 'Increase', sign: '+' },
  decrement: { label: 'Decrease', sign: '-' }
}

/** What a part of a native or measured control needs: a stepper's step, an indicator's width. */
export function partAttributes(node: ComponentElement, uses: MarkupUses): es.SyntaxNode[] {
  const { range } = uses.component
  if (!range || !node.part) return []
  if (uses.kind === 'progress' && node.part === 'indicator') {
    const style = progressWidth(range, es.identifier('value'))
    return style ? [jsx.attribute('style', jsx.container(style))] : []
  }
  const stepper = uses.kind === 'numberField' ? STEPPERS[node.part] : undefined
  if (!stepper) return []
  return [
    jsx.attribute('aria-label', jsx.stringValue(stepper.label)),
    jsx.attribute('disabled', jsx.container(es.identifier('disabled'))),
    jsx.attribute(
      'onClick',
      jsx.container(es.parseExpression(`() => commit(value ${stepper.sign} ${String(range.step)})`))
    )
  ]
}

export const NUMBER_INPUT = [
  ['type', jsx.stringValue('number')],
  ['value', jsx.container(es.parseExpression("Number.isNaN(value) ? '' : value"))],
  [
    'onChange',
    jsx.container(es.parseExpression('(event) => setValue(event.target.valueAsNumber)'))
  ],
  ['onBlur', jsx.container(es.parseExpression('() => commit(value)'))]
] as const

/** A field's input: a number input that commits within its range, or the input or textarea. */
export function inputElement(className: string, uses: MarkupUses, depth: number): es.SyntaxNode {
  const { component } = uses
  const classAttribute = jsx.attribute('className', jsx.container(moduleClass(className)))
  const { range } = component
  if (range)
    return jsx.element(
      'input',
      [
        ...NUMBER_INPUT.map(([name, value]) => jsx.attribute(name, value)),
        numeric('min', range.min),
        numeric('max', range.max),
        numeric('step', range.step),
        jsx.attribute('disabled', jsx.container(es.identifier('disabled'))),
        classAttribute
      ],
      [],
      depth
    )
  const start = component.text?.default
  const placeholder = component.text?.placeholder
  return jsx.element(
    INPUT_PROPS[uses.kind] ?? 'input',
    [
      ...(placeholder ? [jsx.attribute('placeholder', jsx.stringValue(placeholder))] : []),
      ...(start ? [jsx.attribute('defaultValue', jsx.stringValue(start))] : []),
      // The input takes the caller's props, such as `name` or `onChange`.
      jsx.spread(es.identifier('props')),
      classAttribute
    ],
    [],
    depth
  )
}

/** A destructured prop, with the default it takes when the caller leaves it out. */
export interface Parameter {
  name: string
  default?: es.SyntaxNode
}

/** Props a kind reads itself: a progress bar's value, a number field's start and changes. */
export function kindParameters(component: ComponentModel): Parameter[] {
  const { range } = component
  if (component.kind === 'progress' && range)
    return [{ name: 'value', default: es.number(range.default) }]
  if (component.kind === 'numberField' && range)
    return [
      { name: 'defaultValue', default: es.number(range.default) },
      { name: 'onValueChange' },
      { name: 'disabled' }
    ]
  return []
}

/**
 * A number field's value: typed freely, and settled within its range when it loses focus or a
 * stepper moves it, which is when the caller hears of it.
 */
export const NUMBER_STATE = (range: { min: number; max: number }) =>
  es.fill(
    es.parseModule(dedent`
      const [value, setValue] = useState(defaultValue)
      const commit = (next: number) => {
        const settled = Number.isNaN(next) ? $min : Math.min($max, Math.max($min, next))
        setValue(settled)
        onValueChange?.(settled)
      }
    `),
    { $min: es.number(range.min), $max: es.number(range.max) }
  ).body

/** The component function's statements before it returns, such as a number field's state. */
export function prepend(declaration: es.SyntaxNode | undefined, statements: es.SyntaxNode[]): void {
  const fn = es.child(declaration, 'declaration')
  const body = es.child(fn, 'body')
  if (!body || statements.length === 0) return
  body.body = [...statements, ...es.children(body, 'body')]
}
