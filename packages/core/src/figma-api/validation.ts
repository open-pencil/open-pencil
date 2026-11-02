import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

// Figma's plugin API validates arguments with Zod 4 and words what it refuses in its own way
// (Figma desktop 126). OpenPencil checks them with Valibot; this module words the issues as Figma
// does, so a script sees the message it would see in Figma.

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

/** A value outside a fixed list of options. */
function invalidOption(options: Iterable<string>, at = ''): string {
  return `Invalid option: expected one of ${[...options].map((option) => `"${option}"`).join('|')}${at}`
}

/** A literal value, such as a paint type, that the input does not match. */
function invalidLiteral(expected: string, at = ''): string {
  return `Invalid input: expected "${expected}"${at}`
}

export function tooSmall(minimum: number, at = ''): string {
  return `Too small: expected number to be >=${minimum}${at}`
}

function tooBig(maximum: number, at = ''): string {
  return `Too big: expected number to be <=${maximum}${at}`
}

/** A choice between shapes that none of them matches, each listing its own problem. */
function noneMatched(problems: readonly string[], at = ''): string {
  const expected = at
    ? `Expected ${at} to be one of the following`
    : 'Expected one of the following'
  return `${expected}, but none matched:\n${problems.map((problem) => `  ${problem}`).join('\n')}`
}

// --- Reading a schema at an issue's path ---

type Schema = v.GenericSchema
type PathItem = v.IssuePathItem

function property(target: unknown, key: string): unknown {
  return target && typeof target === 'object' ? Reflect.get(target, key) : undefined
}

function isSchema(value: unknown): value is Schema {
  return !!value && typeof value === 'object' && 'kind' in value && '~run' in value
}

function schemaProperty(target: unknown, key: string): Schema | undefined {
  const value = property(target, key)
  return isSchema(value) ? value : undefined
}

/** A picklist's options, or a union's or variant's: the values or schemas it chooses from. */
function listProperty(target: unknown, key: string): readonly unknown[] {
  const value = property(target, key)
  return Array.isArray(value) ? value : []
}

/** The schema under a pipe or an optional wrapper, which decides what a value must be. */
function base(schema: Schema): Schema {
  const [first] = listProperty(schema, 'pipe')
  if (isSchema(first) && first !== schema) return base(first)
  const wrapped = schemaProperty(schema, 'wrapped')
  return wrapped ? base(wrapped) : schema
}

function entries(schema: Schema): Partial<Record<string, Schema>> {
  const value = property(base(schema), 'entries')
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => isSchema(entry)))
}

function options(schema: Schema): readonly Schema[] {
  return listProperty(base(schema), 'options').filter(isSchema)
}

/** A picklist's options, as Figma lists them in its messages. */
function choices(schema: Schema | undefined): string[] {
  return schema ? listProperty(base(schema), 'options').map(String) : []
}

/** The option of a variant that `input`'s discriminator picks. */
function variantOption(schema: Schema, input: unknown): Schema | undefined {
  const key = property(base(schema), 'key')
  if (typeof key !== 'string') return undefined
  const value = property(input, key)
  return options(schema).find((option) => v.is(entries(option)[key] ?? v.never(), value))
}

/** The schema a step down `item` leads to from `schema`. */
function child(schema: Schema, item: PathItem): Schema | undefined {
  const own = base(schema)
  if (own.type === 'variant') {
    const option = variantOption(own, item.input)
    return option && child(option, item)
  }
  if (own.type === 'array') return schemaProperty(own, 'item')
  if (own.type === 'record') return schemaProperty(own, 'value')
  return entries(own)[String(item.key)]
}

function schemaAt(root: Schema, path: readonly PathItem[]): Schema | undefined {
  let schema: Schema | undefined = root
  for (const item of path) schema = schema && child(schema, item)
  return schema
}

// --- Wording ---

/** Where Figma reports an issue: an array item by its index, a field by its path. */
function where(path: readonly PathItem[]): string {
  if (path.length === 0) return ''
  const [first] = path
  if (path.length === 1 && typeof first.key === 'number') return ` at index ${first.key}`
  return ` at ${pathText(path)}`
}

function pathText(path: readonly PathItem[]): string {
  return path
    .map((item) => (typeof item.key === 'number' ? `[${item.key}]` : `.${String(item.key)}`))
    .join('')
}

/** What Figma calls the value each schema expects. */
const EXPECTED: Partial<Record<string, string>> = {
  strict_object: 'object',
  loose_object: 'object',
  object: 'object',
  variant: 'object',
  array: 'array',
  record: 'record',
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  null: 'null'
}

function literalOf(schema: Schema | undefined): string | undefined {
  const literal = schema && property(base(schema), 'literal')
  return typeof literal === 'string' || typeof literal === 'number' || typeof literal === 'boolean'
    ? String(literal)
    : undefined
}

/** A field left out: an option or literal is refused as such, anything else as missing. */
function missing(schema: Schema | undefined, path: readonly PathItem[]): string {
  const own = schema && base(schema)
  if (own?.type === 'picklist') return invalidOption(choices(own), where(path))
  const literal = literalOf(own)
  if (literal !== undefined) return invalidLiteral(literal, where(path))
  return `Required value missing${where(path)}`
}

/** Every key of `input` the object schema does not know, in one line as Figma lists them. */
function unrecognized(schema: Schema | undefined, input: unknown, at: string): string {
  // A variant's keys are those of the option the input's discriminator picks.
  const object = schema && base(schema).type === 'variant' ? variantOption(schema, input) : schema
  const known = object ? entries(object) : {}
  const keys = Object.keys(input && typeof input === 'object' ? input : {}).filter(
    (key) => !Object.hasOwn(known, key)
  )
  const names = keys.map((key) => `"${key}"`).join(', ')
  return `${keys.length === 1 ? 'Unrecognized key' : 'Unrecognized keys'}: ${names}${at}`
}

/** A discriminator no option of the variant takes, listing the ones it knows. */
function unknownDiscriminator(variant: Schema | undefined, key: string, at: string): string {
  const values = (variant ? options(variant) : []).flatMap((option) => {
    const discriminator = entries(option)[key]
    return discriminator && base(discriminator).type === 'picklist'
      ? choices(discriminator)
      : [literalOf(discriminator)]
  })
  return `Expected ${at}.${key} to be one of the following: ${values.join(', ')}`
}

/** Figma's line for a number outside its bounds, or a check's own message; null for others. */
function refinementLine(issue: v.BaseIssue<unknown>, at: string): string | null {
  switch (issue.type) {
    case 'min_value':
      return tooSmall(Number(issue.requirement), at)
    case 'max_value':
      return tooBig(Number(issue.requirement), at)
    case 'integer':
      return `Expected int, received number${at}`
    case 'finite':
      return `Expected number, received ${received(issue.input)}${at}`
    case 'check':
    case 'raw_check':
      return `${issue.message}${at}`
    default:
      return null
  }
}

/**
 * One of Figma's lines for an issue. Its path, relative to `root`, finds the schemas involved;
 * `prefix` places `root` in the value the script passed, for where the line says it is.
 */
function line(issue: v.BaseIssue<unknown>, root: Schema, prefix: readonly PathItem[]): string {
  const relative = issue.path ?? []
  const path = [...prefix, ...relative]
  const last = relative.at(-1)
  if (last?.origin === 'key') {
    if (issue.expected === 'never') {
      const parent = relative.slice(0, -1)
      return unrecognized(schemaAt(root, parent), last.input, where(path.slice(0, -1)))
    }
    return missing(schemaAt(root, relative), path)
  }
  switch (issue.type) {
    // A variant refuses an object by its discriminator, anything else as not an object.
    case 'variant': {
      const variant = schemaAt(root, relative.slice(0, -1))
      if (!last || !variant || property(base(variant), 'key') !== last.key) break
      return unknownDiscriminator(variant, String(last.key), pathText(path.slice(0, -1)))
    }
    case 'picklist':
      return invalidOption(choices(schemaAt(root, relative)), where(path))
    case 'literal': {
      const literal = literalOf(schemaAt(root, relative))
      // Valibot quotes a string literal it expects, as Figma does.
      if (literal === undefined) return `Invalid input: expected ${issue.expected}${where(path)}`
      return invalidLiteral(literal, where(path))
    }
  }
  const refinement = refinementLine(issue, where(path))
  if (refinement) return refinement
  if (issue.input === undefined) return `Required value missing${where(path)}`
  return `Expected ${EXPECTED[issue.type] ?? issue.type}, received ${received(issue.input)}${where(path)}`
}

/** Refusals that do not stop a choice between shapes from settling on the one they came from. */
const REFINEMENTS = ['Too small', 'Too big', 'Expected int', 'Unrecognized key']

/**
 * Figma's lines for `value` against `schema`, empty when it passes. A choice between shapes that
 * fails is worded as Zod words it: the one shape that matched but for its refinements reports
 * alone; otherwise every shape reports, several problems of one shape grouped.
 */
function figmaProblems(schema: Schema, value: unknown, prefix: readonly PathItem[] = []): string[] {
  const own = base(schema)
  if (own.type === 'union') {
    const branches = options(own).map((option) => figmaProblems(option, value, prefix))
    if (branches.some((lines) => lines.length === 0)) return []
    const settled = branches.filter((lines) =>
      lines.every((text) => REFINEMENTS.some((refinement) => text.startsWith(refinement)))
    )
    if (settled.length === 1) return settled[0] ?? []
    // Shapes that fail alike, as every shape fails a missing value, read once.
    return [
      noneMatched(
        uniq(
          branches.map((lines) =>
            lines.length === 1
              ? (lines[0] ?? '')
              : `Multiple issues${where(prefix)}:\n${lines.map((text) => `    ${text}`).join('\n')}`
          )
        ),
        pathText(prefix)
      )
    ]
  }
  const result = v.safeParse(schema, value)
  if (result.success) return []
  return result.issues.map((issue) => {
    // A choice nested in the schema is worded as one, from where it sits.
    if (issue.type === 'union') {
      const at = [...prefix, ...(issue.path ?? [])]
      const nested = schemaAt(schema, issue.path ?? [])
      return nested
        ? figmaProblems(nested, issue.input, at).join('\n')
        : line(issue, schema, prefix)
    }
    return line(issue, schema, prefix)
  })
}

/** A line from an issue alone, a choice listing what each of its shapes found. */
function fallback(issue: v.BaseIssue<unknown>, root: Schema): string {
  if (issue.type !== 'union' || !issue.issues) return line(issue, root, [])
  return noneMatched(uniq(issue.issues.map((nested) => line(nested, root, []))))
}

/**
 * `value` as `schema` reads it, each field read once, or Figma's refusal of it from `method` for
 * `property`.
 */
export function parseFigma<const S extends Schema>(
  schema: S,
  value: unknown,
  method: string,
  property = 'value'
): v.InferOutput<S> {
  const result = v.safeParse(schema, value)
  if (result.success) return result.output
  // Wording a choice reads the value again; a value that reads differently the second time still
  // reports what the first read found.
  const problems = figmaProblems(schema, value)
  const lines =
    problems.length > 0 ? problems : result.issues.map((issue) => fallback(issue, schema))
  throw invalid(method, lines.join('\n'), property)
}
