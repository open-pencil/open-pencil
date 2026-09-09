import * as v from 'valibot'

import { parseJSON } from '../json'

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

export function parseNpmPack(text: string): NpmPackResult {
  const parsed = v.safeParse(packResultSchema, parseJSON(text, 'npm pack'))
  if (!parsed.success) {
    throw new Error(`npm pack: invalid response: ${v.summarize(parsed.issues)}`)
  }
  return parsed.output
}
