/** Figma's message for a value its schema rejects. */
export function invalid(method: string, problem: string, property = 'value'): Error {
  return new Error(`in ${method}: Property "${property}" failed validation: ${problem}`)
}

export function received(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'nan'
  if (Array.isArray(value)) return 'array'
  return value === null ? 'null' : typeof value
}

/** Figma's complaint about `value` as a number at `at`, or null when it is one. */
export function numberProblem(value: unknown, at = ''): string | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return null
  if (value === undefined) return `Required value missing${at}`
  // Shape and size setters spell it as JavaScript does, unlike the text ones `received` follows.
  const kind = Number.isNaN(value) ? 'NaN' : received(value)
  return `Expected number, received ${kind}${at}`
}
