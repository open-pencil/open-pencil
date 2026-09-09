import * as v from 'valibot'

const jsonObjectSchema = v.record(v.string(), v.unknown())

function isPackageRelativePath(path: string): boolean {
  return (
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((part) => part === '..' || part === '.')
  )
}

const packResultSchema = v.pipe(
  v.strictTuple([
    v.object({
      filename: v.pipe(v.string(), v.regex(/^[^/\\]+\.tgz$/)),
      files: v.array(
        v.object({
          path: v.pipe(v.string(), v.nonEmpty(), v.check(isPackageRelativePath))
        })
      )
    })
  ]),
  v.transform(([result]) => ({
    filename: result.filename,
    files: result.files.map(({ path }) => path)
  }))
)

export type NpmPackResult = v.InferOutput<typeof packResultSchema>

function parseJSON(text: string, context: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${context}: invalid JSON`)
  }
}

export function parseJSONObject(
  text: string,
  context: string
): v.InferOutput<typeof jsonObjectSchema> {
  const parsed = v.safeParse(jsonObjectSchema, parseJSON(text, context))
  if (!parsed.success) throw new Error(`${context}: expected an object`)
  return parsed.output
}

export function parseNpmPack(text: string): NpmPackResult {
  const parsed = v.safeParse(packResultSchema, parseJSON(text, 'npm pack'))
  if (!parsed.success) {
    throw new Error(`npm pack: invalid response: ${v.summarize(parsed.issues)}`)
  }
  return parsed.output
}
