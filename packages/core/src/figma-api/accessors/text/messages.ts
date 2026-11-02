// Figma's validation messages, worded as its plugin API words them (Figma desktop 126).

/** Figma's message for a value its schema rejects. */
export function invalid(method: string, problem: string, property = 'value'): Error {
  return new Error(`in ${method}: Property "${property}" failed validation: ${problem}`)
}

export function received(value: unknown): string {
  // Figma names NaN and the infinities rather than calling them numbers.
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) return 'array'
  return value === null ? 'null' : typeof value
}

/** Figma's complaint about `value` as a finite number at `at`, or null when it is one. */
export function numberProblem(value: unknown, at = ''): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return null
  if (value === undefined) return `Required value missing${at}`
  return `Expected number, received ${received(value)}${at}`
}

/** A value outside a fixed list of options. */
export function invalidOption(options: Iterable<string>, at = ''): string {
  return `Invalid option: expected one of ${[...options].map((option) => `"${option}"`).join('|')}${at}`
}

export function tooSmall(minimum: number, at = ''): string {
  return `Too small: expected number to be >=${minimum}${at}`
}

export function tooBig(maximum: number, at = ''): string {
  return `Too big: expected number to be <=${maximum}${at}`
}

/** A literal value, such as a paint type, that the input does not match. */
export function invalidLiteral(expected: string, at = ''): string {
  return `Invalid input: expected "${expected}"${at}`
}

/** Keys an object Figma checks strictly does not know, or null when there are none. */
export function unrecognizedKeys(
  value: object,
  known: ReadonlySet<string>,
  at = ''
): string | null {
  const unknown = Object.keys(value).filter((key) => !known.has(key))
  if (unknown.length === 0) return null
  const names = unknown.map((key) => `"${key}"`).join(', ')
  return `${unknown.length === 1 ? 'Unrecognized key' : 'Unrecognized keys'}: ${names}${at}`
}

/** A choice between shapes that none of them matches, each listing its own problem. */
export function noneMatched(problems: readonly string[]): string {
  return `Expected one of the following, but none matched:\n${problems.map((problem) => `  ${problem}`).join('\n')}`
}
