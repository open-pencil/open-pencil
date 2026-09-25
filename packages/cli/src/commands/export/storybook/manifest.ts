import { readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, posix } from 'node:path'

import * as v from 'valibot'

/**
 * Records which document and page generated each file in a Storybook output folder, so a
 * re-export replaces its own stories and leaves every other file alone.
 */
export const MANIFEST_FILE = '.openpencil-stories.json'

/**
 * A story file or a design image directly under the output folder. The manifest is read
 * from disk and may have been edited, so nothing it lists may point anywhere else.
 */
export function isGeneratedPath(path: string): boolean {
  if (isAbsolute(path) || posix.normalize(path) !== path || path.startsWith('..')) return false
  const folder = posix.dirname(path)
  if (folder === '.') return path.endsWith('.stories.ts')
  return posix.dirname(folder) === '.' && folder.endsWith('.design') && path.endsWith('.png')
}

const StoryOwnerSchema = v.object({ source: v.string(), page: v.string() })

const ManifestSchema = v.object({
  version: v.literal(1),
  files: v.record(
    v.pipe(v.string(), v.check(isGeneratedPath, 'Expected a story or design image path.')),
    StoryOwnerSchema
  )
})

export type StoryOwner = v.InferOutput<typeof StoryOwnerSchema>
export type StoryManifest = v.InferOutput<typeof ManifestSchema>

export async function readManifest(outputDir: string): Promise<StoryManifest> {
  const path = join(outputDir, MANIFEST_FILE)
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return { version: 1, files: {} }
    throw error
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = undefined
  }
  const result = v.safeParse(ManifestSchema, data)
  if (!result.success)
    throw new Error(
      `${path} is not a valid OpenPencil stories manifest; remove it together with the stories it listed, then export again.`
    )
  return result.output
}

/** Written beside the stories and renamed into place, so a failed write keeps the old one. */
export async function writeManifest(outputDir: string, manifest: StoryManifest): Promise<void> {
  const path = join(outputDir, MANIFEST_FILE)
  await writeFile(`${path}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`)
  await rename(`${path}.tmp`, path)
}
