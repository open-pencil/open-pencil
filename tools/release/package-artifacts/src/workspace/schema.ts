import * as v from 'valibot'
const nonempty = v.pipe(v.string(), v.nonEmpty())

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
