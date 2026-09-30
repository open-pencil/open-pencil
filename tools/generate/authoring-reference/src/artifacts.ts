import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { JSX_REFERENCE } from '@open-pencil/core/design-jsx'

const HEADER =
  '<!-- Generated from Core design-jsx/reference and renderer metadata. Do not edit; run bun run generate:authoring-reference. -->\n\n'

export const AUTHORING_REFERENCE_ARTIFACTS = {
  'skills/open-pencil/references/design-authoring.md': HEADER + JSX_REFERENCE,
  'packages/docs/reference/design-authoring.md': HEADER + JSX_REFERENCE
}

export async function writeReferences(root: string): Promise<void> {
  for (const [path, content] of Object.entries(AUTHORING_REFERENCE_ARTIFACTS)) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

export async function staleReferences(root: string): Promise<string[]> {
  const stale: string[] = []
  for (const [path, expected] of Object.entries(AUTHORING_REFERENCE_ARTIFACTS)) {
    const actual = await readFile(join(root, path), 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
      throw error
    })
    if (actual !== expected) stale.push(path)
  }
  return stale
}
