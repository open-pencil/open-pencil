import type { VariableFormulaOperator, VariableLiteral, VariableType } from '#scene-graph/types'

import { variableText, variableTruthy } from '../text'
import { VariableFormulaError } from './tree'

export type FormulaValueType = VariableType

/** One set of operand types an operator takes, and the type it then gives. */
export interface FormulaOverload {
  operands: readonly FormulaValueType[]
  result: FormulaValueType
}

/**
 * Everything about one operator: how it is written and binds, which operand types it takes as
 * Figma's expression signatures list them, and what it computes. The parser, printer, tokenizer,
 * type checker and evaluator all read this table.
 */
interface OperatorSignature {
  /** How the operator is written; the parser reads every spelling, the printer the first. */
  spellings: readonly [string, ...string[]]
  /** Written as a function call, `name(operands)`, rather than around its operands. */
  call?: boolean
  arity: 1 | 2 | 3
  /** How tightly an operator written around its operands binds; calls need none. */
  precedence?: number
  /** Grouping it differently gives the same value, so `a + (b + c)` may print as `a + b + c`. */
  associative?: boolean
  /** Its operations do not chain: `a < b < c` reads as a mistake, not as `(a < b) < c`. */
  nonAssociative?: boolean
  overloads: readonly FormulaOverload[]
  /** What the error says when no overload takes the operands. */
  needs: string
  /** Operands are checked against `overloads` before this runs. */
  apply: (operands: VariableLiteral[]) => VariableLiteral
}

/** Prefix operators bind tighter than every operator written between two operands. */
export const FORMULA_PREFIX_PRECEDENCE = 7

const FLOAT_FLOAT = ['FLOAT', 'FLOAT'] as const
const TEXT_TYPES = ['FLOAT', 'BOOLEAN', 'STRING'] as const

const SIGNATURES: Record<VariableFormulaOperator, OperatorSignature> = {
  add: {
    spellings: ['+'],
    arity: 2,
    precedence: 5,
    associative: true,
    overloads: [
      { operands: FLOAT_FLOAT, result: 'FLOAT' },
      { operands: ['STRING', 'STRING'], result: 'STRING' },
      ...(['FLOAT', 'BOOLEAN'] as const).flatMap((other) => [
        { operands: ['STRING', other], result: 'STRING' } as const,
        { operands: [other, 'STRING'], result: 'STRING' } as const
      ])
    ],
    needs: 'adds numbers or joins text',
    apply: ([a, b]) =>
      typeof a === 'number' && typeof b === 'number'
        ? a + b
        : `${variableText(a) ?? ''}${variableText(b) ?? ''}`
  },
  subtract: arithmetic('-', 5, (a, b) => a - b),
  multiply: { ...arithmetic('*', 6, (a, b) => a * b), associative: true },
  divide: arithmetic('/', 6, (a, b) => {
    if (b === 0) throw new VariableFormulaError('Cannot divide by zero')
    return a / b
  }),
  negate: {
    spellings: ['-'],
    arity: 1,
    precedence: FORMULA_PREFIX_PRECEDENCE,
    overloads: [{ operands: ['FLOAT'], result: 'FLOAT' }],
    needs: 'needs numbers',
    apply: ([a]) => -Number(a)
  },
  equal: equality('==', (a, b) => a === b),
  notEqual: equality('!=', (a, b) => a !== b),
  less: comparison('<', (a, b) => a < b),
  lessOrEqual: comparison('<=', (a, b) => a <= b),
  greater: comparison('>', (a, b) => a > b),
  greaterOrEqual: comparison('>=', (a, b) => a >= b),
  and: logic(['and', '&&'], 2, (a, b) => a && b),
  or: logic(['or', '||'], 1, (a, b) => a || b),
  not: {
    spellings: ['not', '!'],
    arity: 1,
    precedence: FORMULA_PREFIX_PRECEDENCE,
    overloads: [{ operands: ['BOOLEAN'], result: 'BOOLEAN' }],
    needs: 'needs true or false',
    apply: ([a]) => a !== true
  },
  text: {
    spellings: ['text'],
    call: true,
    arity: 1,
    overloads: TEXT_TYPES.map((type) => ({ operands: [type], result: 'STRING' })),
    needs: 'needs a number, text, or true or false',
    apply: ([a]) => variableText(a) ?? ''
  },
  truthy: {
    spellings: ['truthy'],
    call: true,
    arity: 1,
    overloads: TEXT_TYPES.map((type) => ({ operands: [type], result: 'BOOLEAN' })),
    needs: 'needs a number, text, or true or false',
    apply: ([a]) => variableTruthy(a) ?? false
  },
  if: {
    spellings: ['if'],
    call: true,
    arity: 3,
    overloads: (['FLOAT', 'BOOLEAN', 'STRING', 'COLOR'] as const).map((type) => ({
      operands: ['BOOLEAN', type, type],
      result: type
    })),
    needs: 'needs true or false, then two values of the same type',
    apply: ([condition, then, otherwise]) => (condition === true ? then : otherwise)
  }
}

function arithmetic(
  symbol: string,
  precedence: number,
  apply: (a: number, b: number) => number
): OperatorSignature {
  return {
    spellings: [symbol],
    arity: 2,
    precedence,
    overloads: [{ operands: FLOAT_FLOAT, result: 'FLOAT' }],
    needs: 'needs numbers',
    apply: ([a, b]) => apply(Number(a), Number(b))
  }
}

function comparison(symbol: string, apply: (a: number, b: number) => boolean): OperatorSignature {
  return {
    spellings: [symbol],
    arity: 2,
    precedence: 4,
    nonAssociative: true,
    overloads: [{ operands: FLOAT_FLOAT, result: 'BOOLEAN' }],
    needs: 'needs numbers',
    apply: ([a, b]) => apply(Number(a), Number(b))
  }
}

function equality(
  symbol: string,
  apply: (a: VariableLiteral, b: VariableLiteral) => boolean
): OperatorSignature {
  return {
    spellings: [symbol],
    arity: 2,
    precedence: 3,
    nonAssociative: true,
    overloads: TEXT_TYPES.map((type) => ({ operands: [type, type], result: 'BOOLEAN' })),
    needs: 'compares two numbers, two texts, or two true or false values',
    apply: ([a, b]) => apply(a, b)
  }
}

function logic(
  spellings: readonly [string, ...string[]],
  precedence: number,
  apply: (a: boolean, b: boolean) => boolean
): OperatorSignature {
  return {
    spellings,
    arity: 2,
    precedence,
    associative: true,
    overloads: [{ operands: ['BOOLEAN', 'BOOLEAN'], result: 'BOOLEAN' }],
    needs: 'needs true or false',
    apply: ([a, b]) => apply(a === true, b === true)
  }
}

const OPERATORS = Object.keys(SIGNATURES) as VariableFormulaOperator[]

/** Each spelling written between operands, or before one, and the operator it reads as. */
function spellingIndex(written: (signature: OperatorSignature) => boolean) {
  return new Map(
    OPERATORS.filter((operator) => written(SIGNATURES[operator])).flatMap((operator) =>
      SIGNATURES[operator].spellings.map((spelling) => [spelling, operator] as const)
    )
  )
}
const BINARY = spellingIndex(({ arity, call }) => arity === 2 && !call)
const PREFIX = spellingIndex(({ arity, call }) => arity === 1 && !call)
const CALLS = spellingIndex(({ call }) => call === true)

/** Operators spelled as words, such as `and` and `not`, which read as keywords, not names. */
export const FORMULA_KEYWORDS: ReadonlySet<string> = new Set(
  [...BINARY.keys(), ...PREFIX.keys()].filter((spelling) => /^\p{L}+$/u.test(spelling))
)

export function isFormulaOperator(name: string): name is VariableFormulaOperator {
  return Object.hasOwn(SIGNATURES, name)
}

export function formulaArity(operator: VariableFormulaOperator): number {
  return SIGNATURES[operator].arity
}

/** How the operator is printed: its first spelling. */
export function formulaSymbol(operator: VariableFormulaOperator): string {
  return SIGNATURES[operator].spellings[0]
}

export function formulaPrecedence(operator: VariableFormulaOperator): number | undefined {
  return SIGNATURES[operator].precedence
}

/** Written as a function call, such as `if(a, b, c)`, rather than around its operands. */
export function isFormulaCall(operator: VariableFormulaOperator): boolean {
  return SIGNATURES[operator].call === true
}

export function isFormulaAssociative(operator: VariableFormulaOperator): boolean {
  return SIGNATURES[operator].associative === true
}

/** Precedence levels whose operations do not chain, such as the comparisons. */
export const FORMULA_NON_ASSOCIATIVE: ReadonlySet<number> = new Set(
  OPERATORS.flatMap((operator) => {
    const { nonAssociative, precedence } = SIGNATURES[operator]
    return nonAssociative && precedence !== undefined ? [precedence] : []
  })
)

/** The operator written between operands as `spelling`, such as `AND` for `&&`. */
export function binaryFormulaOperator(spelling: string): VariableFormulaOperator | undefined {
  return BINARY.get(spelling.toLowerCase())
}

/** The operator written before an operand as `spelling`, such as `NOT` for `!`. */
export function prefixFormulaOperator(spelling: string): VariableFormulaOperator | undefined {
  return PREFIX.get(spelling.toLowerCase())
}

/** The operator a function call names, such as `TERNARY` for `if`. */
export function formulaCallOperator(name: string): VariableFormulaOperator | undefined {
  return CALLS.get(name.toLowerCase())
}

export function formulaOverloads(operator: VariableFormulaOperator): readonly FormulaOverload[] {
  return SIGNATURES[operator].overloads
}

/** The name an error gives the operator, `if()` for a call, and what it needs. */
export function formulaNeeds(operator: VariableFormulaOperator): { name: string; needs: string } {
  const { call, needs } = SIGNATURES[operator]
  const symbol = formulaSymbol(operator)
  return { name: call ? `${symbol}()` : symbol, needs }
}

/** Compute an operation whose operands have been checked against its overloads. */
export function applyFormulaOperator(
  operator: VariableFormulaOperator,
  operands: VariableLiteral[]
): VariableLiteral {
  return SIGNATURES[operator].apply(operands)
}
