import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { readReleaseNotes, releaseChangelogPath } from './read'

const [version, outputPath] = process.argv.slice(2)
if (!version || !outputPath) {
  throw new Error('Usage: bun release-notes/extract.ts <version> <output-path>')
}

const notes = await readReleaseNotes(await releaseChangelogPath(), version)
await writeFile(resolve(outputPath), notes)
