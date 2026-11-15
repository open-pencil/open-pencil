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

const objectInputSchema = v.pipe(
  v.unknown(),
  v.check(
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected an object, not an array'
  )
)
const stringsSchema = v.pipe(objectInputSchema, v.record(v.string(), v.string()))
const nonemptySchema = v.pipe(v.string(), v.nonEmpty())

export const packageManifestSchema = v.looseObject({
  name: nonemptySchema,
  version: nonemptySchema,
  private: v.optional(v.boolean()),
  /** An SPDX expression, such as `Apache-2.0 AND MIT`. */
  license: v.optional(nonemptySchema),
  files: v.optional(v.array(nonemptySchema)),
  main: v.optional(nonemptySchema),
  types: v.optional(nonemptySchema),
  bin: v.optional(v.union([nonemptySchema, stringsSchema])),
  scripts: v.optional(stringsSchema),
  dependencies: v.optional(stringsSchema),
  devDependencies: v.optional(stringsSchema),
  peerDependencies: v.optional(stringsSchema),
  optionalDependencies: v.optional(stringsSchema),
  exports: v.optional(packageTargetSchema),
  imports: v.optional(v.pipe(objectInputSchema, v.record(v.string(), packageTargetSchema))),
  publishConfig: v.optional(
    v.looseObject({
      access: v.optional(v.picklist(['public', 'restricted'])),
      provenance: v.optional(v.boolean()),
      registry: v.optional(nonemptySchema),
      exports: v.optional(packageTargetSchema),
      imports: v.optional(v.record(v.string(), packageTargetSchema)),
      main: v.optional(nonemptySchema),
      types: v.optional(nonemptySchema),
      bin: v.optional(v.union([nonemptySchema, stringsSchema]))
    })
  )
})
