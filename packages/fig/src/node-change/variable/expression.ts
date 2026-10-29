import type { VariableAnyValue, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'

type Reference = NonNullable<VariableAnyValue['alias']>
interface LinearValue {
  multiplier: number
  reference?: Reference
}
const MAX_EXPRESSION_DEPTH = 64

/**
 * Decode only exactly representable expressions, never approximate: a constant × alias, or an
 * alias Figma turns into text or tests for visibility.
 */
export function linearVariableExpression(
  data: VariableDataEntry | undefined,
  depth = 0
): LinearValue | undefined {
  if (depth > MAX_EXPRESSION_DEPTH) throw new Error('Variable expression exceeds maximum depth')
  const value = data?.value
  if (data?.dataType === 'EXPRESSION' && !value?.expressionValue)
    throw new Error('Missing variable expression value')
  if (!value) return undefined
  if (value.alias) return { multiplier: 1, reference: value.alias }
  if (typeof value.floatValue === 'number' && Number.isFinite(value.floatValue))
    return { multiplier: value.floatValue }
  const expression = value.expressionValue
  if (!expression) return undefined
  // Figma binds a number or boolean to text content as its text, and a boolean or text to
  // visibility as its truth: the variable itself, converted when the binding resolves.
  if (
    expression.expressionFunction === 'STRINGIFY' ||
    expression.expressionFunction === 'IS_TRUTHY'
  )
    return wrappedVariable(expression)
  if (expression.expressionFunction !== 'MULTIPLY' || !expression.expressionArguments?.length) {
    throw new Error(`Unsupported variable expression ${expression.expressionFunction}`)
  }
  return multiplyLinearValues(expression.expressionArguments, depth)
}

function wrappedVariable(
  expression: NonNullable<NonNullable<VariableDataEntry['value']>['expressionValue']>
): LinearValue {
  const args = expression.expressionArguments ?? []
  const reference = args.length === 1 ? args[0].value?.alias : undefined
  const operation = expression.expressionFunction
  if (!reference) throw new Error(`Variable expression ${operation} must wrap one alias`)
  return { multiplier: 1, reference }
}

function multiplyLinearValues(factors: VariableDataEntry[], depth: number): LinearValue {
  const result: LinearValue = { multiplier: 1 }
  for (const argument of factors) {
    const term = linearVariableExpression(argument, depth + 1)
    if (!term || (result.reference && term.reference))
      throw new Error('Variable expression is not a constant multiplied by one alias')
    result.multiplier *= term.multiplier
    if (term.reference) result.reference = term.reference
  }
  if (!Number.isFinite(result.multiplier))
    throw new Error('Variable expression has a non-finite multiplier')
  return result
}

export function visitVariableReferences(
  data: VariableDataEntry | undefined,
  visit: (reference: Reference) => void,
  depth = 0
): void {
  if (depth > MAX_EXPRESSION_DEPTH) throw new Error('Variable expression exceeds maximum depth')
  if (data?.value?.alias) visit(data.value.alias)
  for (const argument of data?.value?.expressionValue?.expressionArguments ?? []) {
    visitVariableReferences(argument, visit, depth + 1)
  }
}
