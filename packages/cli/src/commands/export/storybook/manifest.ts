import { readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, posix } from 'node:path'

import * as v from 'valibot'

/**
 * Records which document and page generated each file in a Storybook output folder, so a
 * re-export replaces its own stories and leaves every other file alone.
 */
export const MANIFEST_FILE = '.openpencil-stories.json'

/** Files the export writes directly in the output folder: stories and generated components. */
const OWN_FILE = /^[^/]+\.(stories\.ts|vue|tsx|module\.css)$/
/** A variant's design image, in its story's `<Name>.design/` folder. */
const DESIGN_IMAGE = /^[^/]+\.design\/[^/]+\.png$/
/** A document's shared files in `openpencil/<document>/`: its fonts and design tokens. */
const SHARED_FILE =
  /^openpencil\/[^/]+\/(fonts\.css|tokens\.css|fonts\/[^/]+\.(woff2|woff|otf|ttf))$/

/**
 * A file the export writes: a story, a generated component and its stylesheet, a design image,
 * or a document's fonts and tokens. The manifest is read from disk and may have been edited, so
 * nothing it lists may point anywhere else.
 */
export function isGeneratedPath(path: string): boolean {
  if (isAbsolute(path) || posix.normalize(path) !== path || path.startsWith('..')) return false
  return OWN_FILE.test(path) || DESIGN_IMAGE.test(path) || SHARED_FILE.test(path)
}

const StoryOwnerSchema = v.object({ source: v.string(), page: v.string() })

const ManifestSchema = v.object({
  version: v.literal(1),
  files: v.record(
    v.pipe(v.string(), v.check(isGeneratedPath, 'Expected a path the Storybook export writes.')),
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
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), ManifestSchema), text)
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
