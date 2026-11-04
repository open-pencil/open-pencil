import * as v from 'valibot'
const nonemptySchema = v.pipe(v.string(), v.nonEmpty())

// This repository deliberately declares literal workspace directories, not glob patterns.
const directorySchema = v.pipe(
  nonemptySchema,
  v.check(
    (path) =>
      !path.startsWith('/') &&
      !/[\\*?[\]{}]/.test(path) &&
      !path.split('/').some((part) => part === '..' || part === '.' || !part)
  )
)

export const workspaceSchema = v.looseObject({
  workspaces: v.pipe(v.array(directorySchema), v.nonEmpty())
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
