import type { BehaviourArgs } from '#dom-css/behaviours/args'
import { INPUT_RESET } from '#dom-css/behaviours/reset'
import type { StateElement } from '#dom-css/behaviours/states/types'
import { omit, pick } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import { es } from '@open-pencil/emit'
import {
  DEFAULT_NUMBER_SETTINGS,
  numberSettings,
  type Behaviour,
  type ComponentPropertyDefinition
} from '@open-pencil/scene-graph'

import type { GeneratedKind, RangeModel, TextModel } from './model'

/** Kinds that hold a number in a range. */
const RANGED: ReadonlySet<GeneratedKind> = new Set(['slider', 'progress', 'numberField'])

/** Kinds whose text layer is an input, and the text value that layer shows. */
const INPUT_VALUES: Partial<Record<GeneratedKind, string>> = {
  textField: 'value',
  textarea: 'value',
  numberField: 'text'
}

/** The text value whose bound layer a kind draws as its input, if it has one. */
export const inputValue = (kind: GeneratedKind): string | undefined => INPUT_VALUES[kind]

/** The number a ranged kind binds, starting where the design's behaviour does. */
export function rangeModel(kind: GeneratedKind, behaviour: Behaviour): RangeModel | null {
  if (!RANGED.has(kind)) return null
  return { ...(numberSettings(behaviour, 'value') ?? DEFAULT_NUMBER_SETTINGS) }
}

/**
 * The text a text field or textarea binds. When the design draws it filled and empty, the
 * empty field shows its text property's words as a placeholder and starts empty; otherwise it
 * starts with them.
 */
export function textModel(
  kind: GeneratedKind,
  definition: ComponentPropertyDefinition | undefined,
  args: BehaviourArgs
): TextModel | null {
  if (kind !== 'textField' && kind !== 'textarea') return null
  const words = typeof definition?.defaultValue === 'string' ? definition.defaultValue : ''
  return args.filled ? { default: '', placeholder: words } : { default: words, placeholder: null }
}

/** A field's text layer drawn as its input, and the same layer in other words, which it replaces. */
export interface InputLayers {
  element: StateElement
  replaced: StateElement[]
}

/** What a text layer's look is, as opposed to where it sits. */
const TEXT_LOOK = [
  'color',
  'opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'text-decoration',
  'text-transform'
]

/**
 * The input among a field's bound text layers: the one shown at rest. A layer reading other
 * words is the same layer in another state; drawn while filled, its look is the typed text's,
 * and the resting look becomes the placeholder's.
 */
export function inputLayers(bound: readonly StateElement[]): InputLayers | null {
  const element = bound.find((layer) => layer.base.display !== 'none') ?? bound.at(0)
  if (!element) return null
  const replaced = bound.filter((layer) => layer !== element)
  const filled = replaced.find((layer) =>
    layer.rules.some((rule) => rule.conditions.some((condition) => condition.type === 'filled'))
  )
  if (filled) {
    const typed = pick(omit(filled.base, ['display']), TEXT_LOOK)
    element.rules.push({
      conditions: [],
      pseudo: 'placeholder',
      style: pick(element.base, TEXT_LOOK)
    })
    element.base = { ...element.base, ...typed }
    // The layer shows in every state now, so states that hid or showed it no longer do.
    element.rules = element.rules.filter((rule) => !rule.style.display)
  }
  element.base = { ...INPUT_RESET, ...omit(element.base, ['display', 'white-space']) }
  return { element, replaced }
}

/** What the library sets on a part it places itself, which the design's drawn place gives way to. */
const PLACED: Partial<Record<GeneratedKind, Record<string, readonly string[]>>> = {
  slider: { range: ['left', 'right', 'width'], thumb: ['left', 'right', 'transform'] },
  progress: { indicator: ['width'] }
}

/**
 * Gives a number field's input, which the design draws as words that hug their value, room
 * for its longest value rather than an input's default width, and no spinner of the browser's
 * own, since the design draws its steppers.
 */
export function numberInput(input: InputLayers | null, range: RangeModel | null): void {
  if (!input || !range) return
  const { element } = input
  element.base = { ...element.base, appearance: 'textfield' }
  element.rules.push({
    conditions: [],
    pseudo: '-webkit-inner-spin-button',
    style: { appearance: 'none', margin: '0' }
  })
  if (Object.hasOwn(element.base, 'width')) return
  const digits = Math.max(String(range.min).length, String(range.max).length)
  element.base = { ...element.base, width: `${digits + 1}ch` }
}

/** Kinds whose root Reka and Radix render as a span, which a size alone does not lay out. */
const SPAN_ROOTS: ReadonlySet<GeneratedKind> = new Set(['slider'])

/** Lays a span root out as the block the design draws, unless the design says otherwise. */
export function blockRoot(kind: GeneratedKind, root: StateElement): void {
  if (SPAN_ROOTS.has(kind) && !Object.hasOwn(root.base, 'display'))
    root.base = { ...root.base, display: 'block' }
}

/** Drops the place a slider or progress bar draws its moving parts at, which the value sets. */
export function freePlacedParts(
  kind: GeneratedKind,
  parts: ReadonlyMap<StateElement, string>
): void {
  for (const [element, part] of parts) {
    const placed = PLACED[kind]?.[part]
    if (!placed) continue
    element.base = omit(element.base, placed)
    element.rules = element.rules
      .map((rule) => ({ ...rule, style: omit(rule.style, placed) }))
      .filter((rule) => !isEmptyObject(rule.style))
  }
}

const PERCENT = es.parseExpression(`({ width: \`\${$share}%\` })`)

/**
 * A progress bar's indicator style, reaching the value's share of its range, the value held
 * within it: the value itself for a range of 0 to 100. Null for an empty range, which has no
 * share.
 */
export function progressWidth(range: RangeModel, value: es.SyntaxNode): es.SyntaxNode | null {
  const span = range.max - range.min
  if (span <= 0) return null
  // A value outside the range fills the indicator no further than its ends.
  const clamped = es.fill(es.parseExpression('Math.min($max, Math.max($min, $value))'), {
    $value: value,
    $min: es.number(range.min),
    $max: es.number(range.max)
  })
  const offset =
    range.min === 0
      ? clamped
      : es.fill(es.parseExpression('$value - $min'), {
          $value: clamped,
          $min: es.number(range.min)
        })
  const share =
    span === 100
      ? offset
      : es.fill(es.parseExpression('(($offset) / $span) * 100'), {
          $offset: offset,
          $span: es.number(span)
        })
  return es.fill(PERCENT, { $share: share })
}
