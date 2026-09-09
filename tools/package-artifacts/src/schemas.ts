import * as v from 'valibot'

export type PackageTarget = string | null | PackageTarget[] | { [condition: string]: PackageTarget }

export const packageTargetSchema: v.GenericSchema<PackageTarget> = v.lazy(() =>
  v.union([
    v.string(),
    v.null(),
    v.array(packageTargetSchema),
    v.record(v.string(), packageTargetSchema)
  ])
)

const objectInput = v.pipe(
  v.unknown(),
  v.check(
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected an object, not an array'
  )
)
const strings = v.pipe(objectInput, v.record(v.string(), v.string()))
const nonempty = v.pipe(v.string(), v.nonEmpty())

export const packageManifestSchema = v.looseObject({
  name: nonempty,
  version: nonempty,
  private: v.optional(v.boolean()),
  files: v.optional(v.array(nonempty)),
  main: v.optional(nonempty),
  types: v.optional(nonempty),
  bin: v.optional(v.union([nonempty, strings])),
  scripts: v.optional(strings),
  dependencies: v.optional(strings),
  devDependencies: v.optional(strings),
  peerDependencies: v.optional(strings),
  optionalDependencies: v.optional(strings),
  exports: v.optional(packageTargetSchema),
  imports: v.optional(v.pipe(objectInput, v.record(v.string(), packageTargetSchema))),
  publishConfig: v.optional(
    v.looseObject({
      access: v.optional(v.picklist(['public', 'restricted'])),
      provenance: v.optional(v.boolean()),
      registry: v.optional(nonempty),
      exports: v.optional(packageTargetSchema),
      imports: v.optional(v.record(v.string(), packageTargetSchema)),
      main: v.optional(nonempty),
      types: v.optional(nonempty),
      bin: v.optional(v.union([nonempty, strings]))
    })
  )
})

// This repository deliberately declares literal workspace directories, not glob patterns.
const directory = v.pipe(
  nonempty,
  v.check(
    (path) =>
      !path.startsWith('/') &&
      !/[\\*?[\]{}]/.test(path) &&
      !path.split('/').some((part) => part === '..' || part === '.' || !part)
  )
)
export const workspaceSchema = v.looseObject({
  workspaces: v.pipe(v.array(directory), v.nonEmpty())
})

export function parseWorkspace(
  value: unknown,
  context: string
): v.InferOutput<typeof workspaceSchema> {
  const parsed = v.safeParse(workspaceSchema, value)
  if (!parsed.success)
    throw new Error(`${context}: expected a workspace manifest: ${v.summarize(parsed.issues)}`)
  return parsed.output
}
